from app.blockchain.block import Block

class Blockchain:
    def __init__(self):
        self.chain = []
        self.pending = []
        self.diff = 4
        self.chain.append(Block(0, "0", []))

    def last(self): return self.chain[-1]

    def add_tx(self, tx): self.pending.append(tx)

    def mine(self, miner):
        self.pending.append({"sender": "SYSTEM", "receiver": miner, "amount": 50})
        b = Block(len(self.chain), self.last().hash, self.pending)
        while not b.hash.startswith("0" * self.diff):
            b.nonce += 1
            b.hash = b.calc()
        self.chain.append(b)
        self.pending = []
        return b

    def get_balance(self, address):
        balance = 0.0
        for block in self.chain:
            for tx in block.transactions:
                if tx.get("receiver") == address:
                    balance += float(tx.get("amount", 0))
                if tx.get("sender") == address:
                    balance -= float(tx.get("amount", 0))
        return round(balance, 4)

    def get_tx_history(self, address):
        history = []
        for block in self.chain:
            for tx in block.transactions:
                if tx.get("sender") == address or tx.get("receiver") == address:
                    history.append({**tx, "block_index": block.index})
        return list(reversed(history))

    def valid(self):
        for i in range(1, len(self.chain)):
            c = self.chain[i]
            p = self.chain[i - 1]
            if c.hash != c.calc() or c.previous_hash != p.hash:
                return False
        return True