-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id"         SERIAL PRIMARY KEY,
    "user_id"    INTEGER NOT NULL,
    "endpoint"   TEXT    NOT NULL UNIQUE,
    "p256dh"     TEXT    NOT NULL,
    "auth"       TEXT    NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscriptions_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
