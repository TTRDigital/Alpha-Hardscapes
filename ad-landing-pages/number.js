/* Call number swap is OFF (Kia, Nov 16, TTR-2206): Google read a script that changes the phone number for ad visitors as a possible misrepresentation.
   Every visitor, and Google's checker, sees the same number. This file only clears anything an earlier visit stored. */
(function () { try { localStorage.removeItem('alpha_call_number'); } catch (e) {} })();
