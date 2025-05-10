const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GroupContributionSchema = new Schema({
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
    contributed_at: {
        type: Date,
        default: Date.now
    },
    payment_method: {
        type: String,
        enum: ['cash', 'bank_transfer', 'momo', 'zalopay', 'other'],
        default: 'cash'
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'rejected'],
        default: 'pending'
    }
});

module.exports = mongoose.model('GroupContribution', GroupContributionSchema);
