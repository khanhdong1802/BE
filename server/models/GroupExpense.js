const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GroupExpenseSchema = new Schema({
    fund_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GroupFund',
        required: true
    },
    member_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GroupMember',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    date: {
        type: Date,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    category_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    receipt_image: {
        type: String,
        default: ''
    },
    approval_status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    approved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
});

module.exports = mongoose.model('GroupExpense', GroupExpenseSchema);
