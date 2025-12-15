import { Orientation, Render } from './Render';
import { PageFlip } from '../PageFlip';
import { FlipDirection } from '../Flip/Flip';
import { PageOrientation } from '../Page/Page';
import { FlipSetting, DisplayType } from '../Settings';

/**
 * Class responsible for rendering the Canvas book
 */
export class CanvasRender extends Render {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;

    constructor(app: PageFlip, setting: FlipSetting, inCanvas: HTMLCanvasElement) {
        super(app, setting);

        this.canvas = inCanvas;
        this.ctx = inCanvas.getContext('2d');
    }

    public getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }

    public reload(): void {
        //
    }

    protected drawFrame(): void {
        this.clear();

        if (this.orientation !== Orientation.PORTRAIT)
            if (this.leftPage != null) this.leftPage.simpleDraw(PageOrientation.LEFT);

        if (this.rightPage != null) {
            if (this.app.getSettings().display === DisplayType.SINGLE)
                this.rightPage.simpleDraw(PageOrientation.LEFT);
            else
                this.rightPage.simpleDraw(PageOrientation.RIGHT);
        }

        if (this.bottomPage != null) this.bottomPage.draw();

        this.drawBookShadow();
        if (this.shadow != null) this.drawFlippingShadow();

        if (this.flippingPage != null) this.flippingPage.draw();

        if (this.shadow != null && this.app.getSettings().flippingShadow) {
            this.drawOuterShadow();
            this.drawInnerShadow();
        }

        const rect = this.getRect();

        if (this.orientation === Orientation.PORTRAIT) {
            this.ctx.beginPath();
            this.ctx.rect(rect.left + rect.pageWidth, rect.top, rect.width, rect.height);
            this.ctx.clip();
        }
    }

    private drawFlippingShadow(): void {
        if (!this.app.getSettings().flippingShadow) return;
        if (!this.flippingPage) return;

        const rect = this.getRect();
        const shadow = this.shadow;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(rect.left, rect.top, rect.width, rect.height);
        this.ctx.clip();

        const shadowPos = this.convertToGlobal({ x: shadow.pos.x, y: shadow.pos.y });
        this.ctx.translate(shadowPos.x, shadowPos.y);
        this.ctx.rotate(Math.PI + shadow.angle + Math.PI / 2);

        const progress = shadow.progress / 100;
        const width = this.app.getSettings().flippingShadowWidthOffset +
                      shadow.width * this.app.getSettings().flippingShadowWidthScale * progress;

        const opacity = this.app.getSettings().flippingShadowOpacity;
        const startAlpha = this.app.getSettings().flippingShadowStartAlpha * opacity;
        const endAlpha = this.app.getSettings().flippingShadowEndAlpha * opacity;

        if (shadow.direction === 0) {                       // BACK
            this.ctx.translate(-width, -100);
            const g = this.ctx.createRadialGradient(width, rect.height, 0, width, rect.height, width);
            g.addColorStop(0, "rgba(0, 0, 0, " + startAlpha + ")");
            g.addColorStop(1, "rgba(0, 0, 0, " + endAlpha + ")");
            this.ctx.fillStyle = g;
        } else {                                              // FORWARD
            this.ctx.translate(0, -100);
            const g = this.ctx.createRadialGradient(0, rect.height, 0, 0, rect.height, width);
            g.addColorStop(0, "rgba(0, 0, 0, " + startAlpha + ")");
            g.addColorStop(1, "rgba(0, 0, 0, " + endAlpha + ")");
            this.ctx.fillStyle = g;
        }
        
        this.ctx.fillRect(0, 0, width, 2 * rect.height);
        this.ctx.restore();
    }

    private drawBookShadow(): void {
        const rect = this.getRect();

        this.ctx.save();
        this.ctx.beginPath();

        const shadowSize = rect.width / 20;
        this.ctx.rect(rect.left, rect.top, rect.width, rect.height);

        const shadowPos = { x: rect.left + rect.width / 2 - shadowSize / 2, y: 0 };
        this.ctx.translate(shadowPos.x, shadowPos.y);

        const outerGradient = this.ctx.createLinearGradient(0, 0, shadowSize, 0);

        outerGradient.addColorStop(0, 'rgba(0, 0, 0, ' + (this.shadow.opacity * this.app.getSettings().flippingShadowEndAlpha) + ')');
        outerGradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.2)');
        outerGradient.addColorStop(0.49, 'rgba(0, 0, 0, 0.1)');
        outerGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.5)');
        outerGradient.addColorStop(0.51, 'rgba(0, 0, 0, 0.4)');
        outerGradient.addColorStop(1, 'rgba(0, 0, 0, ' + (this.shadow.opacity * this.app.getSettings().flippingShadowEndAlpha) + ')');

        this.ctx.clip();

        this.ctx.fillStyle = outerGradient;
        this.ctx.fillRect(0, 0, shadowSize, rect.height * 2);

        this.ctx.restore();
    }

    private drawOuterShadow(): void {
        const rect = this.getRect();

        this.ctx.save();
        this.ctx.beginPath();

        this.ctx.rect(rect.left, rect.top, rect.width, rect.height);

        const shadowPos = this.convertToGlobal({ x: this.shadow.pos.x, y: this.shadow.pos.y });
        this.ctx.translate(shadowPos.x, shadowPos.y);

        this.ctx.rotate(Math.PI + this.shadow.angle + Math.PI / 2);

        const outerGradient = this.ctx.createLinearGradient(0, 0, this.shadow.width, 0);

        if (this.shadow.direction === FlipDirection.FORWARD) {
            this.ctx.translate(0, -100);
            outerGradient.addColorStop(0, 'rgba(0, 0, 0, ' + (this.shadow.opacity * this.app.getSettings().flippingShadowStartAlpha) + ')');
            outerGradient.addColorStop(1, 'rgba(0, 0, 0, ' + (this.shadow.opacity * this.app.getSettings().flippingShadowEndAlpha) + ')');
        } else {
            this.ctx.translate(-this.shadow.width, -100);
            outerGradient.addColorStop(0, 'rgba(0, 0, 0, ' + (this.shadow.opacity * this.app.getSettings().flippingShadowEndAlpha) + ')');
            outerGradient.addColorStop(1, 'rgba(0, 0, 0, ' + (this.shadow.opacity * this.app.getSettings().flippingShadowStartAlpha) + ')');
        }

        this.ctx.clip();

        this.ctx.fillStyle = outerGradient;
        this.ctx.fillRect(0, 0, this.shadow.width, rect.height * 2);

        this.ctx.restore();
    }

    private drawInnerShadow(): void {
        const rect = this.getRect();

        this.ctx.save();
        this.ctx.beginPath();

        const shadowPos = this.convertToGlobal({ x: this.shadow.pos.x, y: this.shadow.pos.y });

        const pageRect = this.convertRectToGlobal(this.pageRect);
        this.ctx.moveTo(pageRect.topLeft.x, pageRect.topLeft.y);
        this.ctx.lineTo(pageRect.topRight.x, pageRect.topRight.y);
        this.ctx.lineTo(pageRect.bottomRight.x, pageRect.bottomRight.y);
        this.ctx.lineTo(pageRect.bottomLeft.x, pageRect.bottomLeft.y);
        this.ctx.translate(shadowPos.x, shadowPos.y);

        this.ctx.rotate(Math.PI + this.shadow.angle + Math.PI / 2);

        const isw = (this.shadow.width * 3) / 4;
        const innerGradient = this.ctx.createLinearGradient(0, 0, isw, 0);

        if (this.shadow.direction === FlipDirection.FORWARD) {
            this.ctx.translate(-isw, -100);

            innerGradient.addColorStop(1, 'rgba(0, 0, 0, ' + this.shadow.opacity + ')');
            innerGradient.addColorStop(0.9, 'rgba(0, 0, 0, 0.05)');
            innerGradient.addColorStop(0.7, 'rgba(0, 0, 0, ' + this.shadow.opacity + ')');
            innerGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        } else {
            this.ctx.translate(0, -100);

            innerGradient.addColorStop(0, 'rgba(0, 0, 0, ' + this.shadow.opacity + ')');
            innerGradient.addColorStop(0.1, 'rgba(0, 0, 0, 0.05)');
            innerGradient.addColorStop(0.3, 'rgba(0, 0, 0, ' + this.shadow.opacity + ')');
            innerGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }

        this.ctx.clip();

        this.ctx.fillStyle = innerGradient;
        this.ctx.fillRect(0, 0, isw, rect.height * 2);

        this.ctx.restore();
    }

    private clear(): void {
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
