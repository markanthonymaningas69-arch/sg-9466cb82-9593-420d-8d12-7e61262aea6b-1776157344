import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const eventType =
    typeof req.body?.data?.attributes?.type === "string"
      ? req.body.data.attributes.type
      : typeof req.body?.data?.attributes?.event_type === "string"
        ? req.body.data.attributes.event_type
        : "unknown";

  console.log("PayMongo webhook received", { eventType });

  return res.status(200).json({ received: true });
}