const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DebtSchema = new Schema({
    lender_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GroupMember',
        required: true
    },
    borrower_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GroupMember',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    debt_date: {
        type: Date,
        default: Date.now
    },
    reason: {
        type: String,
        default: ''
    },
    due_date: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['unpaid', 'paid', 'cancelled'],
        default: 'unpaid'
    }
});

module.exports = mongoose.model('Debt', DebtSchema);
