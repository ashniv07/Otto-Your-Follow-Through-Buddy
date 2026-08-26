import { config } from 'dotenv';
config();
import { InMemoryRunner, InMemorySessionService, LlmAgent } from '@google/adk';

const agent = new LlmAgent({ name: 'test', model: 'gemini-2.5-flash', instruction: 'Reply with {"ok":true}' });
const runner = new InMemoryRunner({ agent, appName: 'test', sessionService: new InMemorySessionService() });

for await (const event of runner.runEphemeral({ userId: 'u1', newMessage: { role: 'user', parts: [{ text: 'ping' }] } })) {
  console.log(JSON.stringify({
    author: event.author,
    errorCode: event.errorCode,
    errorMessage: event.errorMessage,
    hasContent: !!event.content,
    text: event.content?.parts?.[0]?.text?.slice(0, 120),
    actions: event.actions ? Object.keys(event.actions) : null,
  }));
}
console.log('done');
