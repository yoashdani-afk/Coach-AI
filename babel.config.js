module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: 'nativewind',
          // Zustand ESM middleware uses import.meta.env; Metro classic scripts need this transform.
          unstable_transformImportMeta: true,
        },
      ],
      'nativewind/babel',
    ],
  };
};
