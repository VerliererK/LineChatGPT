import { CONFIG } from "../config/config";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  deleteDoc,
  setDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import getTokens from "../utils/getTokens";

const firebaseConfig = {
  projectId: CONFIG.FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const getUserRef = (userID: string) => {
  return doc(db, "users", userID);
};

export const getAllUsers = async () => {
  const snapshot = await getDocs(collection(db, "users"));
  const allUsers = {};
  snapshot.docs.forEach((doc) => {
    const id = doc.id;
    if (!(id in allUsers)) allUsers[id] = [];
    allUsers[id].push(...doc.data().messages);
  });
  return allUsers;
};

export const deleteUser = async (userID: string) => {
  return deleteDoc(getUserRef(userID));
};

export const getToken = async (userID: string) => {
  const ref = getUserRef(userID);
  const user = await getDoc(ref);
  return user.exists() ? Number(user.data().token) : 0;
};

export const getMessages = async (userID: string) => {
  const ref = getUserRef(userID);
  const user = await getDoc(ref);
  return (user.exists() ? user.data().messages : []) as {
    role: string;
    content: string;
  }[];
};

export const setMessages = async (
  userID: string,
  messages: { role: string; content: string }[]
) => {
  if (!Array.isArray(messages)) return;
  const ref = getUserRef(userID);
  while (2048 < getTokens(messages.map((m) => m.content))) {
    messages.shift();
  }
  const finalToken = getTokens(messages.map((m) => m.content));
  return setDoc(ref, { messages: messages, token: finalToken });
};

export const clearMessages = async (userID: string) => {
  return setMessages(userID, []);
};
