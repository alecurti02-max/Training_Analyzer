const { DataTypes } = require('sequelize');

// Keep these two lists as the single source of truth for measurement fields.
// Adding/removing a field here + the corresponding migration is all that's needed.
const CIRCUMFERENCES = [
  'circChest', 'circWaist', 'circHips', 'circShoulders',
  'circBicep', 'circNeck', 'circThigh', 'circCalf',
];
const COMPOSITION = [
  'bodyFat', 'skeletalMuscle', 'subcutaneousFat', 'visceralFat',
  'bodyWater', 'muscleMass', 'boneMass', 'protein',
];
const ALL_FIELDS = [...CIRCUMFERENCES, ...COMPOSITION];

module.exports = (sequelize) => {
  const attrs = {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'uid' },
    },
    date: { type: DataTypes.DATEONLY, allowNull: false },
  };
  for (const f of ALL_FIELDS) attrs[f] = { type: DataTypes.FLOAT, allowNull: true };

  const BodyMeasurement = sequelize.define('BodyMeasurement', attrs, {
    tableName: 'body_measurements',
    timestamps: true,
    indexes: [{ unique: true, fields: ['userId', 'date'] }],
  });

  BodyMeasurement.associate = (models) => {
    BodyMeasurement.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  BodyMeasurement.FIELDS = ALL_FIELDS;
  BodyMeasurement.CIRCUMFERENCES = CIRCUMFERENCES;
  BodyMeasurement.COMPOSITION = COMPOSITION;

  return BodyMeasurement;
};
