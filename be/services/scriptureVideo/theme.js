function getTheme(name = 'simple-reader') {
    if (name !== 'simple-reader') {
        throw new Error(`Unsupported scripture video theme: ${name}`);
    }

    return {
        backgroundColor: '#211e1c',
        surfaceColor: '#474340',
        surfaceMutedColor: '#141414',
        borderColor: '#dbab83',
        accentHex: '#dbab83',
        accentColor: '&H0083ABDB',
        primaryTextColor: '&H00EFEFEF',
        secondaryTextColor: '&H007087A8',
        headingColor: '&H00FFFFFF',
        outlineColor: '&H001C1E21',
        shadowColor: '&H00000000',
        panelColor: '&H6B403F47',
        panelMutedColor: '&H8A141414',
        panelBorderColor: '&H003D5067',
        fontName: process.env.SCRIPTURE_VIDEO_FONT || 'Merriweather',
        brandFontName: process.env.SCRIPTURE_VIDEO_BRAND_FONT || process.env.SCRIPTURE_VIDEO_FONT || 'Merriweather',
    };
}

module.exports = {
    getTheme,
};