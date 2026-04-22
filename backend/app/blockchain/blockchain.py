from blockchain.block import Block


class Blockchain:
    def __init__(self):
        self.chain = []
        self.difficulty = 4
        self.pending_transactions = []
        self.create_genesis_block()

    # genesis block
    def create_genesis_block(self):

    def get_latest_block(self):
        return self.chain[-1]

    # add transaction to mempool
    def add_transaction(self, tx):
        self.pending_transactions.append(tx)

    # mining (proof of work)
    def mine_block(self, miner_address):
        reward_tx = {
            "sender": "SYSTEM",
            "receiver": miner_address,
            "amount": 50
        }

        self.pending_transactions.append(reward_tx)

        new_block = Block(
            len(self.chain),
            self.get_latest_block().hash,
            self.pending_transactions
        )

        self.proof_of_work(new_block)

        self.chain.append(new_block)

        self.pending_transactions = []

        return new_block

    def proof_of_work(self, block):
        while not block.hash.startswith("0" * self.difficulty):
            block.nonce += 1
            block.hash = block.calculate_hash()

    # validate the chain
    def is_chain_valid(self):
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            previous = self.chain[i - 1]

            if current.hash != current.calculate_hash():
                return False

            if current.previous_hash != previous.hash:
                return False

        return True