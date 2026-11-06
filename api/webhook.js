export default async function handler(req, res) {
  if (req.method === 'POST') {
    const update = req.body;

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      
      console.log(`Received message: ${text} from chat: ${chatId}`);
    }

    return res.status(200).json({ status: 'ok' });
  } else {
    return res.status(200).json({ message: 'Tg Watch Webhook is running!' });
  }
}
