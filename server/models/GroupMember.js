const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GroupMemberSchema = new Schema({
    group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'member'],
        default: 'member'
    },
    joined_at: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'removed'],
        default: 'active'
    }
});

module.exports = mongoose.model('GroupMember', GroupMemberSchema);
