/* Color: representing colors and providing some named values.

    TODO: use it more (scene description) or drop it.
*/

class Color {
    constructor(red, green, blue, alpha) {
        this.red = red;
        this.green = green;
        this.blue = blue;
        this.alpha = alpha;
    }
}

Color.GREY = new Color(0.5, 0.5, 0.5, 1.0);
Color.BLUE = new Color(0.0, 0.0, 1.0, 1.0);
Color.BLACK = new Color(0.0, 0.0, 0.0, 1.0);

export { Color };
