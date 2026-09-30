namespace TrapTheOrb.Engine
{
    public static class Field
    {
        /// <summary>
        /// Grid size of the playing field. Portrait is the landscape field turned on its side, so every player —
        /// on any screen — faces the same challenge.
        /// </summary>
        public static GridDims Dims(FieldOrientation orientation) =>
            orientation == FieldOrientation.Portrait
                ? new GridDims(Constants.FieldShortSide, Constants.FieldLongSide)
                : new GridDims(Constants.FieldLongSide, Constants.FieldShortSide);

        /// <summary>Portrait for tall boxes (width / height below 1), landscape otherwise.</summary>
        public static FieldOrientation OrientationForAspect(double aspect) =>
            JsMath.IsFinite(aspect) && aspect > 0 && aspect < 1 ? FieldOrientation.Portrait : FieldOrientation.Landscape;
    }
}
