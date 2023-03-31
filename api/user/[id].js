// firestore run with vercel edge function will not terminate, need call deleteApp manually.
// so create api with vercel serverless function to access firestore...
import { getMessages, getToken, setMessages } from "../../lib/firestore"

export default async (req, res) => {
  try {
    const { id } = req.query;
    const { body } = req;
    if (body) {
      const { messages } = body;
      if (!Array.isArray(messages))
        throw TypeError("invalid data, messages is null or not array");
      if (!messages.every((m) => m.role != null && m.content != null))
        throw TypeError("invalid data, role or content not in messages");
      await setMessages(id, messages);
      return res.status(200).end();
    } else {
      const messages = await getMessages(id);
      const token = await getToken(id);
      return res.status(200).send(JSON.stringify({ token, messages }));
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send(err.message);
  }
};
