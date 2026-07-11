CREATE TABLE chat_messages (
  id uuid PRIMARY KEY,
  channel text NOT NULL,
  author text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_channel_sent_at_idx ON chat_messages (channel, sent_at DESC);
