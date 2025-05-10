const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DebtPaymentSchema = new Schema({
    debt_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Debt',
        required: true
    },
    payment_amount: {
        type: Number,
        required: true,
        min: 0
    },
    payment_date: {
        type: Date,
        default: Date.now
    },
    payment_method: {
        type: String,
        enum: ['cash', 'bank_transfer', 'momo', 'zalopay', 'other'],
        default: 'cash'
    },
    note: {
        type: String,
        default: ''
    }
});

module.exports = mongoose.model('DebtPayment', DebtPaymentSchema);

