const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GroupFundSchema = new Schema({
    group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    end_date: {
        type: Date,
        default: null
    },
    balance: {
        type: Number,
        default: 0
    },
    purpose: {
        type: String,
        default: ''
    }
});

module.exports = mongoose.model('GroupFund', GroupFundSchema);
