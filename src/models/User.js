import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema, model } = mongoose;

const ExperienceSchema = new Schema(
  {
    place: { type: String, required: true, trim: true, maxlength: 100 },
    story: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);


const UserSchema = new Schema(
  {
    
    name: {
      type:      String,
      required:  [true, 'Name is required'],
      trim:      true,
      minlength: [2,  'Name must be at least 2 characters'],
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    username: {
      type:      String,
      required:  [true, 'Username is required'],
      unique:    true,
      trim:      true,
      lowercase: true,
      minlength: [3,  'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match:     [/^[a-z0-9_]+$/, 'Username: lowercase letters, numbers and underscores only'],
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      trim:      true,
      lowercase: true,
      match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select:    false,  // ← NEVER returned in query results by default
    },

    role: {
      type:    String,
      enum:    ['Guest', 'Host', 'Staff', 'Admin', 'Owner'],
      default: 'Guest',
    },
    isActive:        { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },

   
    phone:               { type: String, trim: true, default: null },
    photo:               { type: String, default: null },  // stored filename
    bio:                 { type: String, trim: true, maxlength: 500, default: '' },
    favoriteDestination: { type: String, trim: true, maxlength: 100, default: '' },

    // ── Admin / Staff management fields ─────────────────────────────────────────
    specialization: {
      type:    String,
      enum:    ['All Property Types', 'Luxury Villas', 'Urban Apartments', 'Beachfront & Coastal', 'Boutique & Heritage', 'Eco & Nature Retreats'],
      default: 'All Property Types',
    },
    verificationId: { type: String, trim: true, default: '' },
    notes:          { type: String, trim: true, default: '' },

  
    interests: {
      type:    [String],
      enum:    ['beach','mountain','city','history','foodie','adventure','wellness','backpack'],
      default: [],
    },
    preferences: {
      type:    [String],
      enum:    ['entire','hotel','cabin','shared','camp'],
      default: [],
    },
    experiences: { type: [ExperienceSchema], default: [] },

   
    refreshTokens: {
      type:    [String],
      select:  false,
      default: [],
    },
    passwordChangedAt:    { type: Date,   select: false },
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },
    loginAttempts:        { type: Number, default: 0, select: false },
    lockUntil:            { type: Date,   select: false },
    otpCode:              { type: String, select: false },
    otpExpires:           { type: Date,   select: false },
  },
  {
    timestamps: true,           
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

UserSchema.index({ createdAt: -1 });

UserSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});


UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const rounds  = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, rounds);

  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});


UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.tokenIssuedBeforePasswordChange = function (jwtIssuedAt) {
  if (!this.passwordChangedAt) return false;
  return this.passwordChangedAt.getTime() / 1000 > jwtIssuedAt;
};


UserSchema.methods.addRefreshToken = async function (token) {
  if (this.refreshTokens.length >= 5) this.refreshTokens.shift();
  this.refreshTokens.push(token);
  await this.save();
};

UserSchema.methods.removeRefreshToken = async function (token) {
  this.refreshTokens = this.refreshTokens.filter(t => t !== token);
  await this.save();
};


UserSchema.methods.removeAllRefreshTokens = async function () {
  this.refreshTokens = [];
  await this.save();
};


UserSchema.methods.incrementLoginAttempts = async function () {

  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const updates = { $inc: { loginAttempts: 1 } };

  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({ $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
};


UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  const sensitiveFields = [
    'password','refreshTokens','passwordResetToken',
    'passwordResetExpires','loginAttempts','lockUntil',
    'passwordChangedAt','__v',
  ];
  sensitiveFields.forEach(f => delete obj[f]);
  obj.dateCreated = obj.createdAt
    ? new Date(obj.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';
  return obj;
};

export default model('User', UserSchema);   