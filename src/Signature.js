import React, { useState, useRef, useEffect } from 'react';
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { Check, FileText, PenTool } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Logo Component
function StoreLogo() {
  return (
    <div className="flex items-center gap-3 justify-center mb-8">
      <div className="relative">
        <div className="w-10 h-10 bg-orange-500 rounded-sm transform rotate-12"></div>
        <div className="w-10 h-10 bg-gray-700 rounded-sm absolute top-0 left-0 transform -rotate-6"></div>
        <div className="w-10 h-10 bg-gray-800 rounded-sm absolute top-0 left-0"></div>
      </div>
      <div>
        <span className="text-2xl font-bold text-gray-800">store</span>
        <span className="text-2xl font-bold text-orange-500">here</span>
        <div className="text-sm text-gray-500 uppercase tracking-wider">SELF STORAGE</div>
      </div>
    </div>
  );
}

function Signature() {
  const [userAttributes, setUserAttributes] = useState({});
  const [loading, setLoading] = useState(true);
  const [importantNotesRead, setImportantNotesRead] = useState(false);
  const [conditionsRead, setConditionsRead] = useState(false);
  const [processing, setProcessing] = useState(false);
  const sigCanvas = useRef(null);
  const [signatureData, setSignatureData] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUserAttributes(attributes);
    } catch (error) {
      console.error('Error loading user:', error);
      window.location.href = '/signin';
    } finally {
      setLoading(false);
    }
  };

  // Canvas drawing functions
  const clearSignature = () => {
    sigCanvas.current.clear();
    setSignatureData(null);
  };

  const saveSignature = () => {
    if (sigCanvas.current.isEmpty()) {
      setSignatureData(null);
    } else {
      setSignatureData(sigCanvas.current.toDataURL());
    }
  };

  const generateAndUploadPDF = async () => {
    try {
      // Create PDF content
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Add header
      pdf.setFontSize(20);
      pdf.text('StoreHere Storage Agreement', 20, 30);
      
      // Add user info
      pdf.setFontSize(12);
      pdf.text(`Name: ${userAttributes.given_name} ${userAttributes.family_name}`, 20, 50);
      pdf.text(`Email: ${userAttributes.email}`, 20, 60);
      pdf.text(`Date: ${new Date().toLocaleDateString('en-AU')}`, 20, 70);
      
      // Add signature
      if (signatureData) {
        pdf.addImage(signatureData, 'PNG', 20, 80, 50, 25);
        pdf.text('Digital Signature', 20, 115);
      }
      
      // Generate PDF blob
      const pdfBlob = pdf.output('blob');
      
      // Upload to S3
      const fileName = `agreements/${userAttributes.sub}_${Date.now()}.pdf`;
      await uploadToS3(pdfBlob, fileName);
      
      return fileName;
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  };

  const uploadToS3 = async (pdfBlob, fileName) => {
    // Convert blob to base64
    const base64Data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(pdfBlob);
    });
    
    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/upload-agreement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileData: base64Data,
        fileName,
        userInfo: {
          userId: userAttributes.sub,
          email: userAttributes.email
        }
      })
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    return response.json();
  };

  const handleSubmit = async () => {
    if (!importantNotesRead) {
      alert('Please confirm you have read the Important Notes');
      return;
    }
    if (!conditionsRead) {
      alert('Please confirm you have read the Conditions of Agreement');
      return;
    }
    if (!signatureData) {
      alert('Please provide your digital signature');
      return;
    }

    setProcessing(true);
    
    try {
      // Generate and upload PDF
      const fileName = await generateAndUploadPDF();
      console.log('Agreement saved:', fileName);
      
      window.location.href = '/payment';
    } catch (error) {
      console.error('Error saving agreement:', error);
      alert('Error saving agreement. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <StoreLogo />
            <div className="text-sm text-gray-600">
              Welcome, {userAttributes.given_name} {userAttributes.family_name}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
            Storage Agreement
          </h1>

          {/* Important Notes Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-6 h-6 text-orange-500" />
              <h2 className="text-xl font-bold text-gray-800">Important Notes</h2>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-4">
              <div className="space-y-3 text-sm text-gray-700">
                <p>• All payments are to be made in advance by you (the Storer)</p>
                <p>• Goods are stored at your risk. We recommend that you take out insurance cover.</p>
                <p>• The Facility Owner (the "FO") is excluded from liability for the loss of any goods stored on its premises, except for laws which cannot be excluded, including rights under Australian Consumer Law.</p>
                <p>• You must not store hazardous, dangerous, illegal, stolen, flammable, perishable, environmentally harmful or explosive goods.</p>
                <p>• You must store all your property inside your container – no goods can be stored outside or on top of your container</p>
                <p>• Unless specifically itemized and covered by insurance you must also not store goods that are irreplaceable such as currency, jewellery, furs, deeds, paintings, curios, works of art and items of personal sentimental value or items worth more than $2000 AUD in total. While the FO takes reasonable care to provide a secure Space, we cannot guard against all risks and unforeseen circumstances beyond our control and therefore, we recommend that you take out insurance in relation to items you intend to store in the Space or store valuable goods in places specifically designed for this purpose (i.e. a safety deposit box).</p>
                <p>• 7 days' notice must be given for termination of this agreement.</p>
                <p>• The Storer must notify the FO of all changes to their or the ACP's address, email, telephone numbers or other contact details</p>
                <p>• If you fail to comply with material terms in this agreement the FO will have certain rights which include forfeiture of any Deposit and the right to seize and sell and/or dispose of your goods (see clause 6)</p>
                <p>• The FO may have the right to refuse access if all fees are not paid promptly (see clause 11)</p>
                <p>• The FO has the right to enter the Space in certain circumstances (see clauses 6, 13, 14, 19, 20, 21 & 23)</p>
                <p>• The FO may use a microprobe or CCTV to view inside the Space and rely on footage to enforce the contract, and/or may release footage to authorities (see clause 21A) in certain circumstances, including where the FO reasonably suspects breach of the law or damage to premises.</p>
                <p>• The FO may discuss your account, any default and your details with the ACP. Upon termination, default, or death the FO may elect to release items to the ACP (see clause 10(i)).</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="important_notes"
                checked={importantNotesRead}
                onChange={(e) => setImportantNotesRead(e.target.checked)}
                className="mt-1 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                required
              />
              <label htmlFor="important_notes" className="text-sm text-gray-700">
                <span className="text-red-500">*</span> I have read and understood the Important Notes above
              </label>
            </div>
          </div>

          {/* Conditions of Agreement Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Conditions of Agreement</h2>
            
            <div className="bg-gray-50 border rounded-lg p-6 max-h-96 overflow-y-auto mb-4">
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <h3 className="font-semibold">STORAGE:</h3>
                  <p>1. The Storer:</p>
                  <p>(a) may store Goods in the Space allocated to the Storer by the Facility Owner ("FO"), and only in that Space:</p>
                  <p>(b) has knowledge of the Goods in the Space;</p>
                  <p>(c) warrants that they are the owner of the Goods in the Space, and/or are entitled at law to deal with them accordance with all aspects of this Agreement</p>
                </div>

                <div>
                  <p>2. The FO :</p>
                  <p>(a) does not have, and will not be deemed to have, knowledge of the Goods;</p>
                  <p>(b) is not a bailee nor a warehouseman of the Goods and the Storer acknowledges that the FO does not take possession of the Goods;</p>
                  <p>(c) claims a contractual lien over the Goods in the event any moneys are owing under the Agreement.</p>
                </div>

                <div>
                  <h3 className="font-semibold">COST:</h3>
                  <p>The Storer must upon signing the Agreement pay to the FO: Pay the Deposit (which, when applicable, will be refunded within 30 days of termination of this Agreement); and/or any other Fee(s) specified on the front of this Agreement or in any Fee Schedule.</p>
                  <p>The Storer is responsible to pay: the Storage Fee being the amount indicated in this Agreement or any reasonable increase as notified to the Storer by the FO. The FO will provide no less than 28 days' notice of any intended increase. Where the Storer objects to the increase they may, before the expiration of the 28 days' notice, terminate the Agreement and move out giving no less than 24 hours' notice. The usual notice period is waived. The Storage Fee is payable in advance and it is the Storer's responsibility to make payment directly to the FO on time, and in full, throughout the period of storage. Any Storage Fees paid by direct deposit/direct credit ("Direct Payment") will not be credited to the Storer's account unless the Storer identifies the Direct Payment clearly and as reasonably directed by the FO. The FO is indemnified from any claim for enforcement of the Agreement, including the sale or disposal of Goods, due to the Storer's failure to correctly identify a Direct Payment; the Cleaning Fee, as indicated on the front on this Agreement, is payable at the FO's reasonable discretion; a Late Payment Fee, as indicated on the front on this Agreement, which becomes payable each time a payment is late; any reasonable costs incurred by the FO in collecting late or unpaid Storage Fees, or in enforcing this Agreement in any way, including but not limited to postal, telephone, debt collection, personnel and/ or the Default Action costs. The Storer will be responsible for payment of any government taxes or charges (including any goods and services tax) being levied on this Agreement, or any supplies pursuant to this Agreement.</p>
                </div>

                <div>
                  <h3 className="font-semibold">DEFAULT:</h3>
                  <p>Notwithstanding clause 23, and subject to clause 6 (b), the Storer acknowledges that, in the event of the Storage Fee, or any other moneys owing under this Agreement, not being paid in full within 42 days of the due date, the FO may enter the Space, by force or otherwise, retain any Deposit and/or sell or dispose of any Goods in the Space on such terms that the FO may determine ("Default Action"). For the purposes of the Personal Property Securities Act 2009, the FO is deemed to be in possession of the Goods from the moment the FO accesses the Space. The Storer consents to and authorises the sale or disposal by any means of all Goods regardless of their nature or value. The FO may also require payment of Default Action costs, including any costs associated with accessing the Storer's Space and disposal or sale of the Storer's Goods. Any excess funds will be returned to the Storer within 6 months of the sale of goods. In the event that the Storer cannot be located, excess funds will be deposited with the Public Trustee or equivalent authority. In the event that the Storer has more than one Space with the FO, default on either Space authorises the FO to take Default Action against all Spaces. At least 14 days before the FO can take any Default Action the FO will provide the Storer with Notice that the Storer is in Default. The FO will provide the Storer with reasonable time to rectify the Default before any Default Action is taken.</p>
                </div>

                <div>
                  <h3 className="font-semibold">RIGHT TO DUMP:</h3>
                  <p>If the FO reasonably believes it is a health and safety risk to sort, handle, assess or conduct an inventory of Goods in the Space, subject to the FO providing the Storer with reasonable prior notice to pay outstanding moneys and collect the goods, the FO may dispose of some or all of the Goods without sorting, handling, assessing or undertaking inventory. Further, due to the inherent health and safety risks in relation to undertaking any sale or disposal of Goods whereby the FO must handle the Storer's Goods, the FO need not open or empty bags or boxes to sort, handle, assess or undertake an inventory of the contents therein, and may elect to instead dispose of all bagged and/or boxed items with or without opening them. Further, if, in the reasonable opinion of the FO a default Storer's Goods are either not saleable or fail to sell when offered for sale or are not of sufficient value to warrant the expense of attempting to sell, the FO may dispose of the Goods in the Storer's Space by any means. Further, upon Termination of the Agreement (Clause 23) by either the Storer or the FO, in the event that a Storer fails to remove all Goods from their Space or the Facility the FO is authorised to dispose of all Goods by any means 7 days from the Termination Date, regardless of the nature or value of the Goods. The FO will give 7 days' notice of intended disposal. Any items deemed left, in the FO's reasonable opinion, unattended in common areas or outside the Storer's Space at any time may at the FO's reasonable discretion be sold, disposed, moved or dumped immediately and at the expense and liability of the Storer.</p>
                </div>

                <div>
                  <h3 className="font-semibold">ACCESS AND CONDITIONS:</h3>
                  <p>The Storer: has the right to access the Space during Access Hours as advised by the FO and subject to the terms of this Agreement; will be solely responsible for the securing of the Space and shall so secure the Space at all times when the Storer is not in the Space in a manner reasonably acceptable to the FO, and where applicable will secure the external gates and/or doors of the Facility. Where the Storer refuses to secure the Space, the FO may apply a lock and post the keys to the Storer at the Storer's expense. The Storer is not permitted to apply a padlock to their Space in the FO's overlocking position, and the Storer may have any such padlock forcefully cut off at the Storer's expense; must not store any Goods that are hazardous, dangerous, illegal, stolen, flammable, explosive, environmentally harmful, perishable, living, or that are a risk to the property of any person; must not store items which are irreplaceable, such as currency, jewellery, furs, deeds, paintings, curios, works of art, items of personal sentimental value and/or any items that are worth more than $2000AUD in total unless they are itemised and covered by insurance; will use the Space solely for the purpose of storage and shall not carry on any business or other activity iiincluding reside, dwell or loiter in the Space; must not attach nails, screws etc to any part of the Space, must maintain the Space by ensuring it is clean and in a state of good repair, and must not damage or alter the Space without the FO's consent; in the event of uncleanliness of or damage to the Space or Facility or other Storer's Goods the FO will be entitled to retain any Deposit, charge a Cleaning Fee, and/or full reimbursement by the Storer to the value of the damage, repairs and/or cleaning; cannot assign this Agreement; must give Notice of change of address, phone numbers or email address of the Storer or the Alternate Contact Person ("ACP") within 48 hours of any change; grants the FO entitlement to discuss and provide information it holds regarding the Storer – including default information - with the ACP registered on the front of this Agreement. Further, where the FO reasonably believes that the Storer is unwilling or unable to remove Goods from the Space upon termination or default of the Agreement, despite reasonable notice under these terms, the Facility Owner may allow the ACP to remove the Goods on such terms as agreed between the FO and the ACP without the need for further consent from the Storer. Further, where the FO has reasonable proof that the Storer is deceased, the FO is authorised to force access to the Space and release all Goods to the ACP;is solely responsible for determining whether the Space is appropriate and suitable for storing (J) the Storer's Goods, having specific consideration for the size, nature and condition of the Space and Goods; must ensure their Goods are free of food scraps and are not damp when placed into storage. (k) In addition to clause 6, the FO has the right to refuse access to the Space and/or the Facility where any moneys are owing by the Storer to the FO where a demand or notice relating to payment of such money has been made.</p>
                </div>

                <div>
                  <p>7. The FO will not be liable for any loss or damaged suffered by the Storer resulting from any inability to access the Facility or the Space.</p>
                  <p>8. The FO reserves the right to relocate the Storer to another Space under certain circumstances, including but not limited to unforeseen extraordinary events or redevelopment of the Facility.</p>
                  <p>9. The FO may dispose of the Storer's Goods in the event that Goods are damaged due to fire, flood or other event that has rendered Goods, in the reasonable opinion of the FO severely damaged, or dangerous to the Facility, any persons, or other Storers and/or their Goods. Where practicable, the FO will provide the Storer with reasonable Notice and an opportunity to review the Goods before the Goods are disposed of.</p>
                  <p>10. The Storer acknowledges that it has raised with the FO all queries relevant to its decision to enter this Agreement and that the FO has, prior to the Storer entering into this Agreement, answered all such queries to the satisfaction of the Storer. The Storer acknowledges that any matters resulting from such queries have, to the extent required by the Storer and agreed to by the FO, been reduced to writing and incorporated into the terms of this Agreement.</p>
                  <p>15A The Storer is responsible (and must pay) for loss or damage caused by a third party who enters the Space or the Facility at the request, direction, or as facilitated by the Storer (including provision of gate key code or swipe card).</p>
                </div>

                <div>
                  <h3 className="font-semibold">RISK AND RESPONSIBILITY:</h3>
                  <p>11. The FO's services come with non-excludable guarantees under consumer protection law, including that they will be provided with due care and skill. Otherwise, to the extent permitted by law, the Goods are stored at the sole risk and responsibility of the Storer who shall be responsible for any and all theft, damage to, and deterioration of the Goods, and shall bear the risk of any and all damage caused by flood or fire or leakage or overflow of water, mildew, mould, heat, spillage of material from any other space, removal or delivery of the Goods, pest or vermin or any other reason whatsoever.</p>
                  <p>12. Where loss, damage or injury is caused by the Storer, or liability arises from the Storer's actions or the Storer's Goods, the Storer agrees to indemnify and keep indemnified the FO from any liability arising from and all claims for any loss of or damage to the property of, or personal injury to or death of the Storer, the Facility, the FO or third parties, or legislative or common law breach, resulting from or incidental to the use of the Space by the Storer, including but not limited to the storage of Goods in the Space, the Goods themselves, defaulting on the Agreement and/or accessing the Facility.</p>
                  <p>13. Certain laws may apply to the storage of goods including criminal, bankruptcy, liquidation, privacy and others. The Storer acknowledges and agrees to comply with all relevant laws, including Acts and Ordinances, Regulations, By-laws, and Orders, as are or may be applicable to the use of the Space. This includes laws relating to the material which is stored, the manner in which it is stored, and its disposal upon Default. Such liability and responsibility rests with the Storer and includes any and all costs resulting from such a breach.</p>
                  <p>14. If the FO reasonably believes that the Storer is not complying with any relevant laws the FO may take any action as it reasonably believes to be necessary, including the action outlined in clauses 21, 21A & 23, contacting, cooperating with and/or submitting Goods to the relevant authorities, and/or immediately disposing of or removing the Goods at the Storer's expense and liability, including where in the FO's reasonable opinion the Storer is engaging in illegal activity in relation to the storage of the Goods. No failure or delay by the FO to exercise its rights under this Agreement will operate to waive those rights.</p>
                </div>

                <div>
                  <h3 className="font-semibold">INSPECTION AND ENTRY BY THE FO:</h3>
                  <p>15. Subject to clause 21 and 21A the Storer consents to inspection and entry of the Space by the FO provided that the FO gives 14 days' Notice.</p>
                  <p>21 In the event of an emergency, that is where obliged to do so by law or in the event that property, the environment or human life is, in the reasonable opinion of the FO, threatened, the FO may enter the Space using all necessary force without the consent of the Storer, but the FO shall thereafter notify the Storer as soon as practicable. The Storer consents to such entry.</p>
                  <p>21A The Storer agrees that in circumstances where the FO reasonably suspects a breach of the law or damage to the facility, the FO may use a microprobe or other CCTV camera to view the inside of the Space and any footage obtained which evidences a breach of the Agreement or the law may be relied upon by the FO to take any action authorised under this Agreement, including terminating the Agreement and/or cooperating with law enforcement agencies and other authorities.</p>
                  <p>22. NOTICE: Notice by the FO will usually be given by email or SMS, or otherwise will be left at, or posted to, or faxed to the address of the Storer. In relation to the giving of Notice by the Storer to the FO, Notice must be in writing and actually be received to be valid, and the FO may specify a required method. In the event of not being able to contact the Storer, Notice is deemed to have been given to the Storer by the FO if the FO has sent Notice to the last notified address or has sent Notice via any other contact method, including by SMS or email to the Storer or the ACP without any electronic 'bounce back' or similar notification. In the event that there is more than one Storer, notice to or by any single Storer is agreed to be sufficient for the purposes of any Notice requirement under this Agreement</p>
                  <p>23. TERMINATION: Once the initial fixed period of storage has ended, either party may terminate this Agreement by giving the other party Notice of the Termination Date in accordance with the period indicated on the front of this Agreement. In the event any activities on the part of the Storer are reasonably considered by the FO to be illegal or environmentally harmful, antisocial, threatening or offensive, the FO may terminate the Agreement without Notice. The FO is entitled to retain or charge apportioned storage fees if less than the requisite Notice is given by the Storer. The Storer must remove all Goods in the Space before the close of business on the Termination Date and leave the Space in a clean condition and in a good state of repair to the satisfaction of the FO. In the event that Goods are left in the Space after the Termination Date, clause 8 will apply. The Storer must pay any outstanding Storage Fees and any expenses on default or any other moneys owed to the FO up to the Termination Date, or clauses 6, 7 or 8 may apply. If the FO enters the Space for any reason and there are no Goods stored therein, the FO may terminate the Agreement without giving prior Notice, but the FO will send Notice to the Storer within 7 days.</p>
                  <p>24. The Parties' liability for outstanding moneys, property damage, personal injury, environmental damage and legal responsibility under this Agreement continues to run beyond the termination of this Agreement.</p>
                  <p>25. SEVERANCE If any clause, term or provision of this Agreement is legally unenforceable or is made inapplicable, or in its application would breach any law, that clause, term or provision shall be severed or read down, but so as to maintain (as far as possible) all other terms of the Agreement</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="conditions_read"
                checked={conditionsRead}
                onChange={(e) => setConditionsRead(e.target.checked)}
                className="mt-1 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                required
              />
              <label htmlFor="conditions_read" className="text-sm text-gray-700">
                <span className="text-red-500">*</span> I have read and agree to the Conditions of Agreement above
              </label>
            </div>
          </div>

          {/* Digital Signature Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <PenTool className="w-6 h-6 text-orange-500" />
              <h2 className="text-xl font-bold text-gray-800">Digital Signature</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Signature <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-gray-300 rounded-lg" style={{ width: '400px', height: '152px' }}>
                  <SignatureCanvas
                    ref={sigCanvas}
                    canvasProps={{
                      width: 400,
                      height: 150,
                      style: { width: '400px', height: '150px' }
                    }}
                    onEnd={saveSignature}
                    backgroundColor='rgb(255,255,255)'
                  />
                </div>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="mt-2 text-sm text-orange-600 hover:text-orange-700"
                >
                  Clear Signature
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
                  {new Date().toLocaleDateString('en-AU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <button
              onClick={handleSubmit}
              disabled={processing || !importantNotesRead || !conditionsRead || !signatureData}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white py-3 px-8 rounded-lg font-semibold text-lg"
            >
              {processing ? 'Saving Agreement...' : 'Sign Agreement & Continue to Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signature;