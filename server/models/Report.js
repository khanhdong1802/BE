const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReportSchema = new Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: false // vì có thể báo cáo cá nhân hoặc nhóm
    },
    report_type: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly'],
        required: true
    },
    start_date: {
        type: Date,
        required: true
    },
    end_date: {
        type: Date,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    content: {
        expenses: {
            type: Number,
            default: 0
        },
        income: {
            type: Number,
            default: 0
        }
    }
});

module.exports = mongoose.model('Report', ReportSchema);
