import requests


class Node:
    def __init__(self):
        self.nodes = set()

    # register a new node
    def register_node(self, address: str):
        self.nodes.add(address)

    # broadcast a transaction to all peers
    def broadcast_transaction(self, tx):
        for node in self.nodes:
            try:
                requests.post(f"{node}/transaction/add", json=tx)
            except:
                pass

    # consensus: resolve conflicts between chains
    def resolve_conflicts(self, blockchain):
        longest_chain = None
        max_length = len(blockchain.chain)

        for node in self.nodes:
            try:
                response = requests.get(f"{node}/chain")
                data = response.json()

                length = data["length"]
                chain = data["chain"]

                if length > max_length:
                    max_length = length
                    longest_chain = chain
            except:
                pass

        if longest_chain:
            blockchain.chain = self.rebuild_chain(longest_chain)
            return True

        return False

    # helper to rebuild block objects from json
    def rebuild_chain(self, chain_data):
        from blockchain.block import Block

        new_chain = []

        for block_data in chain_data:
            block = Block(
                block_data["index"],
                block_data["previous_hash"],
                block_data["transactions"],
                block_data["nonce"]
            )
            block.hash = block_data["hash"]
            block.timestamp = block_data["timestamp"]

            new_chain.append(block)

        return new_chain