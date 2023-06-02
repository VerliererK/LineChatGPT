import { CONFIG } from "../config/config";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import getTokens from "../utils/getTokens";

initializeApp({
  credential: cert(JSON.parse(
    Buffer.from(CONFIG.FIREBASE_CERT, "base64").toString("utf8")
  )),
});
const db = getFirestore();

export const getAllUsers = async () => {
  const snapshot = await db.collection("users").get();
  const allUsers = {};
  snapshot.docs.forEach((doc) => {
    const id = doc.id;
    if (!(id in allUsers)) allUsers[id] = [];
    allUsers[id].push(...doc.data().messages);
  });
  return allUsers;
};

export const deleteUser = async (userID: string) => {
  return db.collection("users").doc(userID).delete();
};

export const getToken = async (userID: string) => {
  const user = await db.collection("users").doc(userID).get();
  return user.exists ? user.data()?.token : "";
};

export const getMessages = async (userID: string) => {
  const user = await db.collection("users").doc(userID).get();
  return (user.exists ? user.data()?.messages : []) as {
    role: string;
    content: string;
  }[];
};

export const setMessages = async (
  userID: string,
  messages: { role: string; content: string }[]
) => {
  if (!Array.isArray(messages)) return;
  while (2048 < getTokens(messages.map((m) => m.content))) {
    messages.shift();
  }
  const finalToken = getTokens(messages.map((m) => m.content));
  return db.collection("users").doc(userID).set({ messages: messages, token: finalToken });
};

export const clearMessages = async (userID: string) => {
  return setMessages(userID, []);
};
