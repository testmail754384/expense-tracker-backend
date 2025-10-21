const mongoose = require('mongoose');

// Define allowed categories
const expenseCategories = [
  "Food",
  "Transport",
  "Shopping",
  "Utilities",
  "Rent",
  "Health",
  "Entertainment",
  "Education",
  "Other",
];

const incomeCategories = [
  "Salary",
  "Bonus",
  "Gifts",
  "Investment",
  "Freelance",
  "Other",
];

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the user
    required: true,
  },
  type: {
    type: String,
    enum: ['income', 'expense'], // Only these two types allowed
    required: true,
  },
  category: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return this.type === 'income'
          ? incomeCategories.includes(v)
          : expenseCategories.includes(v);
      },
      message: (props) => `${props.value} is not a valid category for ${props.instance.type}`,
    },
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount must be positive'],
  },
  date: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  receipt: {
    type: String, // Can store file URL or path
  },
}, {
  timestamps: true, // createdAt, updatedAt
});

module.exports = mongoose.model('Transaction', transactionSchema);
