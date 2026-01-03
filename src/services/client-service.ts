import { addDoc, getDocs, query, orderBy, Timestamp, doc, updateDoc } from "firebase/firestore";
import { getCollectionRef } from "../lib/firestore-utils";

export interface Client {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  cpf?: string;
  address?: string;
  createdAt?: Timestamp;
}

const COLLECTION_NAME = "clients";

export async function addClient(client: Client) {
  try {
    const colRef = getCollectionRef(COLLECTION_NAME);
    const docRef = await addDoc(colRef, {
      ...client,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding client: ", error);
    throw error;
  }
}

export async function getClients() {
  try {
    const colRef = getCollectionRef(COLLECTION_NAME);
    const q = query(colRef, orderBy("name"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Client[];
  } catch (error) {
    console.error("Error getting clients: ", error);
    throw error;
  }
}

export async function updateClient(clientId: string, data: Partial<Client>) {
  try {
    const colRef = getCollectionRef(COLLECTION_NAME);
    const docRef = doc(colRef, clientId);
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Error updating client: ", error);
    throw error;
  }
}

