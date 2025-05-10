const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ExpenseSchema = new Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    payment_method: {
        type: String,
        enum: ['cash', 'bank_transfer', 'credit_card', 'e_wallet'],
        default: 'cash'
    },
    receipt_image: {
        type: String,
        default: ''
    }
});

module.exports = mongoose.model('Expense', ExpenseSchema);
