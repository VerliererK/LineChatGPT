import { encode } from "./GPTEncoder";

export default (text: string | string[]) => {
  if (Array.isArray(text)) {
    return encode(text.join("")).length;
  }
  return encode(text).length;
};
