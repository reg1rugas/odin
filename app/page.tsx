import Odin from "@/components/odin";
import Welcome from "./welcome/page";
import { getChatGPTUser } from "./chatgpt-auth";
export default async function Home() {
  return (await getChatGPTUser()) ? <Odin /> : <Welcome />;
}
