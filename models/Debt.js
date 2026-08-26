import mongoose from 'mongoose';

const DebtSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['unpaid', 'partially_paid', 'settled'],
    default: 'unpaid'
  },
  dueDate: {
    type: Date,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Debt = mongoose.model('Debt', DebtSchema);
export default Debt;
