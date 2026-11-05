// A upi:// deep link that opens the phone's UPI app with the payee filled in (amount left to the payer).
export const upiLink = ({ pa, pn }) => `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&cu=INR`;
