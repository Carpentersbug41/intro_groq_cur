// /lib/storeInFirestore.ts

import { db } from "./firebase";
import { doc, setDoc, collection } from "firebase/firestore";

// Our minimal function that writes data to Firestore
export async function storeDataInFirestore(
  collectionName: string,
  docId: string | undefined,
  data: Record<string, any>
): Promise<void> {
  try {
    if (docId) {
      // If docId is provided, store with that docId
      await setDoc(doc(db, collectionName, docId), data, { merge: true });
    } else {
      // If no docId is specified, let Firestore auto-generate one
      const ref = collection(db, collectionName);
      await setDoc(doc(ref), data);
    }
    console.log("✅ Data stored successfully in Firestore");
  } catch (error) {
    console.error("🔥 Error storing data in Firestore:", error);
  }
}
