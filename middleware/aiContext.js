module.exports = function buildAIContext(transactions) {
  return transactions.map(tx => ({
    date: tx.date,
    type: tx.type,
    category: tx.category,
    amount: tx.amount,
    description: tx.description || ""
  }));
};
