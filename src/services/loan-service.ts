import { addDoc, getDocs, query, orderBy, Timestamp, where, updateDoc, doc } from "firebase/firestore";
import { getCollectionRef } from "../lib/firestore-utils";

export interface Loan {
  id?: string;
  clientId: string;
  clientName: string;
  documentNumber?: string; // New field
  loanDate: Timestamp;
  amount: number;
  dueDate: Timestamp;
  termDays: number;
  interestRate: number; // Percentual
  interestValue: number;
  totalAmount: number;
  status: 'pending' | 'paid';
  paymentDate?: Timestamp; // New field
  createdAt?: Timestamp;
}

const COLLECTION_NAME = "loans";

export async function addLoan(loan: Loan) {
  try {
    const colRef = getCollectionRef(COLLECTION_NAME);
    const docRef = await addDoc(colRef, {
      ...loan,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding loan: ", error);
    throw error;
  }
}

export async function updateLoan(loanId: string, data: Partial<Loan>) {
    try {
      const colRef = getCollectionRef(COLLECTION_NAME);
      const docRef = doc(colRef, loanId);
      await updateDoc(docRef, data);
    } catch (error) {
      console.error("Error updating loan: ", error);
      throw error;
    }
}

export async function getLoans() {
  try {
    const colRef = getCollectionRef(COLLECTION_NAME);
    const q = query(colRef, orderBy("loanDate", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Loan[];
  } catch (error) {
    console.error("Error getting loans: ", error);
    throw error;
  }
}

export async function getLoansByClient(clientId: string) {
    try {
      const colRef = getCollectionRef(COLLECTION_NAME);
      const q = query(colRef, where("clientId", "==", clientId), orderBy("loanDate", "desc"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Loan[];
    } catch (error) {
      console.error("Error getting client loans: ", error);
      throw error;
    }
}

export async function updateLoanStatus(loanId: string, status: 'pending' | 'paid') {
  try {
    const colRef = getCollectionRef(COLLECTION_NAME);
    const docRef = doc(colRef, loanId);
    await updateDoc(docRef, { status });
  } catch (error) {
    console.error("Error updating loan status: ", error);
    throw error;
  }
}

