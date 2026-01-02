import { collection } from "firebase/firestore";
import { db } from "./firebase";

export function getCollectionRef(collectionName: string) {
  // Caminho Compartilhado (Raiz do App):
  // /artifacts/{appId}/{collectionName}
  // Ex: artifacts/controle-cheques/clients (3 segments -> Valid Collection)
  const appId = "controle-cheques";
  const path = `artifacts/${appId}/${collectionName}`;
  
  return collection(db, path);
}
