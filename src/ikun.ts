const TOUCH_EVENT = 1
const MOUSE_EVENT = 2

const EVENT_TYPE: Record<string, number> = {
    touchstart: TOUCH_EVENT,
    touchmove: TOUCH_EVENT,
    touchend: TOUCH_EVENT,
  
    mousedown: MOUSE_EVENT,
    mousemove: MOUSE_EVENT,
    mouseup: MOUSE_EVENT,
    mouseleave: MOUSE_EVENT
}

// 坐标旋转
const rotatePoint = (cx: number, cy: number, x: number, y: number, angle: number): {x: number, y: number} => {
    const radians = (Math.PI / 180) * angle
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const nx = (cos * (x - cx)) + (sin * (y - cy)) + cx
    const ny = (cos * (y - cy)) - (sin * (x - cx)) + cy
    return {
        x: nx, 
        y: ny
    }
}

interface IKunOptions {
    container: HTMLElement
    muted?: boolean
}

class IKun {
    muted: boolean

    count = 0

    v = {
        r: 12, // 角度
        x: 0,
        y: 2, // 高度
        t: 0, // 垂直速度
        w: 0, // 横向速度
        d: 0.988 // 衰减
    }
    inertia = 0.08 // 惯性
    sticky = 0.1 // 粘性
    maxR = 60 // 最大角度
    maxY = 110 // 最大高度

    last: number | null = null
    rotate = 0
    initiated: number | false = false
    pageX: number = 0
    pageY: number = 0

    container: HTMLElement
    canvas: HTMLCanvasElement
    context: CanvasRenderingContext2D
    image: HTMLImageElement
    outline: HTMLDivElement
    audio: {
        transient: HTMLAudioElement
        dancing: HTMLAudioElement
        crazy: HTMLAudioElement
    }

    height = 800
    width = 500

    // 椭圆方程
    a = this.height / 2
    b = this.width / 2

    // 坤坤的平衡点
    // xc: number
    // yc: number
    
    // 触摸开始时坤坤的位置
    x0 = 0
    y0 = 0
    
    // 坤坤当前的位置
    x = 0
    y = 0

    // 弹簧动画
    mass = 1
    stiffness = 0.0006
    damping = 0.001
    velocity = 0
    time = Date.now()

    constructor({container, muted = false}: IKunOptions) {
        this.muted = muted

        this.audio = {
            transient: new Audio(`${process.env.ASSET_PREFIX}/j.mp3`),
            dancing: new Audio(`${process.env.ASSET_PREFIX}/jntm.mp3`),
            crazy: new Audio(`${process.env.ASSET_PREFIX}/ngm.mp3`)
        }
        const {height, width} = this
        this.container = container
        container.style.position = 'relative'
        container.style.height = height + 'px'
        container.style.width = width + 'px'

        const image = this.image = new Image(197, 300)
        image.src = 'kun.png'

        const outline = this.outline = document.createElement('div')
        outline.style.position = 'absolute'
        outline.style.left = '50%'
        outline.style.top = '50%'
        outline.style.transform = 'translate(-50%, -50%)'
        outline.appendChild(image)

        const dpr = window.devicePixelRatio || 1
        const canvas = this.canvas = document.createElement('canvas')
        canvas.width = width * dpr
        canvas.height = height * dpr
        canvas.style.width = width + 'px'
        canvas.style.height = height + 'px'

        const context = this.context = canvas.getContext('2d')!
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.scale(dpr, dpr)

        this.mount()
    }

    setMuted = (muted: boolean): void => {
        Object.values(this.audio).forEach(item => {
            item.muted = true
            item.play()
            item.pause()
            item.muted = muted
        })
        this.muted = muted
    }

    mount() {
        const {outline, container} = this

        outline.addEventListener('mousedown', this.start)
        outline.addEventListener('touchstart', this.start)
        document.addEventListener('mousemove', this.move)
        document.addEventListener('touchmove', this.move)
        document.addEventListener('mouseup', this.end)
        document.addEventListener('mouseleave', this.end)
        document.addEventListener('touchcancel', this.end)
        document.addEventListener('touchend', this.end)

        container.appendChild(outline)
        container.appendChild(this.canvas)
    }

    dispose = () => {
        const {outline, container} = this

        outline.removeEventListener('mousedown', this.start)
        outline.removeEventListener('touchstart', this.start)
        document.removeEventListener('mousemove', this.move)
        document.removeEventListener('touchmove', this.move)
        document.removeEventListener('mouseup', this.end)
        document.removeEventListener('mouseleave', this.end)
        document.removeEventListener('touchcancel', this.end)
        document.removeEventListener('touchend', this.end)

        container.removeChild(outline)
        container.removeChild(this.canvas)
    }

    start = (event: TouchEvent | MouseEvent) => {
        event.preventDefault()
        const eventType = EVENT_TYPE[event.type]
        if (this.initiated && this.initiated !== eventType) {
            return
        }
        this.initiated = eventType

        const touch = 'targetTouches' in event ? event.touches[0] : event
        this.pageX = touch.pageX
        this.pageY = touch.pageY
        this.x0 = this.x
        this.y0 = this.y
    }

    move = (event: TouchEvent | MouseEvent) => {
        if (EVENT_TYPE[event.type] !== this.initiated) {
            return
        }

        const { pageX, pageY } = 'targetTouches' in event ? event.touches[0] : event

        const deltaX = pageX - this.pageX
        const deltaY = pageY - this.pageY

        let x = this.x0 + deltaX
        let y = this.y0 + deltaY

        x = Math.max(-this.a, x)
        x = Math.min(this.a, x)

        y = Math.max(-this.maxY, y)
        y = Math.min(this.maxY, y)

        this.x = x
        this.y = y

        this.draw()
    }

    end = (event: TouchEvent | MouseEvent) => {
        if (EVENT_TYPE[event.type] !== this.initiated) {
            return
        }
        this.initiated = false
        this.run()
        this.play()
    }

    play = () => {
        this.count++

        const {transient, dancing, crazy} = this.audio
        if (this.count > 2) {
            this.count = 0;
            crazy.currentTime = 0
            crazy.play()
            transient.pause()
            dancing.pause()
        } else if (Math.abs(this.v.r) <= 6) {
            transient.currentTime = 0
            transient.play()
            dancing.pause()
            crazy.pause()
        } else if (Math.abs(this.v.r) > 6 && Math.abs(this.v.r) <= 30) {
            dancing.currentTime = 0
            dancing.play()
            transient.pause()
            crazy.pause()
        } else if (Math.abs(this.v.r) > 30) {
            crazy.currentTime = 0
            crazy.play()
            transient.pause()
            dancing.pause()
        }
    }

    draw = () => {
        const { a, b, x } = this

        const rx = x
        const ry =  Math.sqrt((1 - Math.pow(x, 2) / Math.pow(a, 2)) * Math.pow(b, 2))
        const rotate = Math.atan(rx / ry) / Math.PI * 180

        const y = ry - b

        this.image.style.transform = `rotate(${rotate}deg) translateX(${x}px) translateY(${y}px)`

        const {context, width, height} = this

        // context.clearRect(0, 0, width, height)
        // context.save()
    
        // context.strokeStyle = '#182562'
        // context.lineWidth = 10
    
        // context.beginPath()
        // context.translate(
        //     width / 2 ,
        //     640 // height - 160
        // )
        // context.moveTo(
        //     0,
        //     200
        // )
    
        // const cx = 0
        // const cy = -100
    
        // const n = rotatePoint(
        //     cx,
        //     cy,
        //     r,
        //     -y,
        //     r
        // )
    
        // const nx = n.x
        // const ny = -n.y - 100
        
        // context.quadraticCurveTo(
        //     0,
        //     75,
        //     nx,
        //     ny
        // )

        // context.stroke()
        // context.restore()
    }

    loop = () => {
        if(this.initiated) {
            return
        }

        const fs = -this.stiffness * this.x
        let fd = this.damping * (this.velocity)
        const acceleration = (fs - fd) / this.mass

        const now = Date.now()
        const interval = now - this.time
        this.time = now

        this.velocity += acceleration * interval
        this.x += this.velocity * interval

        this.draw()
        requestAnimationFrame(this.loop)
    }

    run = () => {
        this.time = Date.now()
        this.velocity = 0
        requestAnimationFrame(this.loop)
    }
}

export default IKun
