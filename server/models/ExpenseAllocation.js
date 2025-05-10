const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ExpenseAllocationSchema = new Schema({
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
    percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    max_amount: {
        type: Number,
        default: 0
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ExpenseAllocation', ExpenseAllocationSchema);
