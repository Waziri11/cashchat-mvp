import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  waId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  businessName: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', UserSchema);
export default User;
