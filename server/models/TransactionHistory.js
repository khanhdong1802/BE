const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TransactionHistorySchema = new Schema({
    transaction_type: {
        type: String,
        enum: ['expense', 'income', 'debt_payment', 'contribution'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    transaction_date: {
        type: Date,
        default: Date.now
    },
    description: {
        type: String,
        default: ''
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['completed', 'pending', 'failed'],
        default: 'completed'
    }
});

module.exports = mongoose.model('TransactionHistory', TransactionHistorySchema);
