# Eliza-PinataAI

An **AI trading agent on Sui** combines on-chain and off-chain components to operate autonomously.

## Links

- [Website](https://ai.pinatabot.com)
- [Frontend-GitHub-Code](https://github.com/PinataBot/eliza-pinata-frontend)
- [Smart-Contract-GitHub-Code](https://github.com/PinataBot/eliza-pinata)
- [Backend-GitHub-Code](https://github.com/PinataBot/eliza-pinata)
- [NFT object of character (Suivision)](https://suivision.xyz/object/0x2c23a00b61d6465b671decf2ef469a87be4114984a423d32da76e836d0728054?tab=Fields)

## High-Level Architecture

- **AI Engine (ElizaOS / Off-Chain Backend)**: The core AI logic runs off-chain on a backend server + OpenAI API. This
  is where the agent analyzes market data and computes trading decisions.
- **Sui Smart-Contract (On-Chain)**: Smart contracts on the Sui blockchain act as the coordination layer that links the
  AI agent to on-chain assets and data. They manage the agent’s on-chain identity, permissions, and interactions with
  other contracts(e.g. DeFi protocols). Sui’s object-oriented Move language is used to define the agent as a resource(
  NFT) and implement logic for data access and trade execution.
- **AI-Agent NFT (On-Chain)**: The agent is represented on Sui as a NFT – a unique on-chain object encapsulating the
  agent’s identity and metadata. This NFT serves as an interface to the agent’s data and state. It holds references to
  the agent’s model data and possibly its trading history or performance metrics stored off-chain.
- **Decentralized Storage (Walrus)**: Large data like AI model weights or trade logs are stored in Walrus. Walrus
  provides cost-effective, robust storage for big data “blobs”. The AI-agent NFT contains a reference (such as a content
  ID or resource handle) to the Walrus-stored data. This ensures the agent’s neural network and results are available in
  a decentralized way, and the blockchain can verify the data’s existence and integrity​. When mainnet will be launched,
  we will use Walrus for decentralized storage for smart contract fields, now it's only possible using our backend.
- **On-Chain Trading Module(Soon)**: The agent interacts with on-chain trading protocols (such as a Sui DEX or liquidity
  pool smart contract) to execute trades. When the AI decides to buy or sell a cryptocurrency, it will invoke a smart
  contract function (via a transaction) to perform the trade on-chain. Sui’s DeFi infrastructure (for example, an
  on-chain order book like DeepBook or an AMM) provides the venues where the agent’s transactions are executed in a
  trustless, transparent manner.

**Workflow:** The AI backend periodically gathers market data, runs the model to decide trades(all off-chain
computation), then uses the Sui smart contract interface to record its decisions and take actions on-chain. For
instance, the AI-Agent NFT program might send a transaction to update the NFT’s stored results in Walrus after each
trade. The system is designed such that the NFT hold the necessary state(like current portfolio or strategy parameters),
Walrus holds the bulk data, and the AI backend does the thinking. This separation of concerns ensures the blockchain is
used for state, ownership, and execution of trades, while heavy AI processing is done off the chain.

**Goal:** Standardizing how AI-agents are represented(NFT + Walrus) and how they communicate (smart contract interfaces
and shared storage), we can create a rich ecosystem where multiple AI agents are not isolated. They can share data,
interact in contracts, compete or cooperate, and even be composed into higher-level strategies. The end result is an
ecosystem of autonomous AI agents leveraging decentralized infrastructure to collectively push the frontier of
algorithmic trading and blockchain-based AI.

## Errors

Fix better-sqlite3 build error

```
cd node_modules/better-sqlite3
npm run build-release
cd ..
```

---

# ElizaOS Markdown

## Edit the character files

Open `src/character.ts` to modify the default character. Uncomment and edit.

### Custom characters

To load custom characters instead:

- Use `pnpm start --characters="path/to/your/character.json"`
- Multiple character files can be loaded simultaneously

### Add clients

```
# in character.ts
clients: [Clients.TWITTER, Clients.DISCORD],

# in character.json
clients: ["twitter", "discord"]
```

## Duplicate the .env.example template

```bash
cp .env.example .env
```

\* Fill out the .env file with your own values.

### Add login credentials and keys to .env

```
DISCORD_APPLICATION_ID="discord-application-id"
DISCORD_API_TOKEN="discord-api-token"
...
OPENROUTER_API_KEY="sk-xx-xx-xxx"
...
TWITTER_USERNAME="username"
TWITTER_PASSWORD="password"
TWITTER_EMAIL="your@email.com"
```

## Install dependencies and start your agent

```bash
pnpm i && pnpm start
```

or using pm2 for production

start:

```bash
pm2 start pnpm -- start
```

logs:

```bash
pm2 logs
```

Note: this requires node to be at least version 22 when you install packages and run the agent.

## Run with Docker

### Build and run Docker Compose (For x86_64 architecture)

#### Edit the docker-compose.yaml file with your environment variables

```yaml
services:
  eliza:
    environment:
      - OPENROUTER_API_KEY=blahdeeblahblahblah
```

#### Run the image

```bash
docker compose up
```

### Build the image with Mac M-Series or aarch64

Make sure docker is running.

```bash
# The --load flag ensures the built image is available locally
docker buildx build --platform linux/amd64 -t eliza-starter:v1 --load .
```

#### Edit the docker-compose-image.yaml file with your environment variables

```yaml
services:
  eliza:
    environment:
      - OPENROUTER_API_KEY=blahdeeblahblahblah
```

#### Run the image

```bash
docker compose -f docker-compose-image.yaml up
```

# Deploy with Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/aW47_j)
