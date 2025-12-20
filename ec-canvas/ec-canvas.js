import WxCanvas from './wx-canvas';
import * as echarts from './echarts';

let ctx;

function compareVersion(v1, v2) {
  v1 = v1.split('.')
  v2 = v2.split('.')
  const len = Math.max(v1.length, v2.length)

  while (v1.length < len) {
    v1.push('0')
  }
  while (v2.length < len) {
    v2.push('0')
  }

  for (let i = 0; i < len; i++) {
    const num1 = parseInt(v1[i])
    const num2 = parseInt(v2[i])

    if (num1 > num2) {
      return 1
    } else if (num1 < num2) {
      return -1
    }
  }
  return 0
}

/** 获取两点间距离 */
function getDistance(t0, t1) { 
  return Math.hypot(t0.x-t1.x, t0.y-t1.y);
}

// 优化的节流函数 - 避免闭包内存泄漏
function throttle(func, limit = 50) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      func.apply(this, args);
    }
  };
}

Component({
  properties: {
    canvasId: {
      type: String,
      value: 'ec-canvas'
    },

    ec: {
      type: Object
    },

    forceUseOldCanvas: {
      type: Boolean,
      value: false
    }
  },

  data: {
    isUseNewCanvas: false
  },

  ready: function () {
    // Disable prograssive because drawImage doesn't support DOM as parameter
    // See https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.drawImage.html
    echarts.registerPreprocessor(option => {
      if (option && option.series) {
        if (option.series.length > 0) {
          option.series.forEach(series => {
            series.progressive = 0;
          });
        }
        else if (typeof option.series === 'object') {
          option.series.progressive = 0;
        }
      }
    });

    if (!this.data.ec) {
      console.warn('组件需绑定 ec 变量，例：<ec-canvas id="mychart-dom-bar" '
        + 'canvas-id="mychart-bar" ec="{{ ec }}"></ec-canvas>');
      return;
    }

    if (!this.data.ec.lazyLoad) {
      this.init();
    }
  },

  methods: {
    init: function (callback) {
      const version = wx.getSystemInfoSync().SDKVersion

      const canUseNewCanvas = compareVersion(version, '2.9.0') >= 0;
      const forceUseOldCanvas = this.data.forceUseOldCanvas;
      const isUseNewCanvas = canUseNewCanvas && !forceUseOldCanvas;
      this.setData({ isUseNewCanvas });

      if (forceUseOldCanvas && canUseNewCanvas) {
        console.warn('开发者强制使用旧canvas,建议关闭');
      }

      if (isUseNewCanvas) {
        // console.log('微信基础库版本大于2.9.0，开始使用<canvas type="2d"/>');
        // 2.9.0 可以使用 <canvas type="2d"></canvas>
        this.initByNewWay(callback);
      } else {
        const isValid = compareVersion(version, '1.9.91') >= 0
        if (!isValid) {
          console.error('微信基础库版本过低，需大于等于 1.9.91。'
            + '参见：https://github.com/ecomfe/echarts-for-weixin'
            + '#%E5%BE%AE%E4%BF%A1%E7%89%88%E6%9C%AC%E8%A6%81%E6%B1%82');
          return;
        } else {
          console.warn('建议将微信基础库调整大于等于2.9.0版本。升级后绘图将有更好性能');
          this.initByOldWay(callback);
        }
      }
    },

    initByOldWay(callback) {
      // 1.9.91 <= version < 2.9.0：原来的方式初始化
      ctx = wx.createCanvasContext(this.data.canvasId, this);
      const canvas = new WxCanvas(ctx, this.data.canvasId, false);

      if (echarts.setPlatformAPI) {
        echarts.setPlatformAPI({
          createCanvas: () => canvas,
        });
      } else {
        echarts.setCanvasCreator(() => canvas);
      };
      // const canvasDpr = wx.getSystemInfoSync().pixelRatio // 微信旧的canvas不能传入dpr
      const canvasDpr = 1
      var query = wx.createSelectorQuery().in(this);
      query.select('.ec-canvas').boundingClientRect(res => {
        if (typeof callback === 'function') {
          this.chart = callback(canvas, res.width, res.height, canvasDpr);
        }
        else if (this.data.ec && typeof this.data.ec.onInit === 'function') {
          this.chart = this.data.ec.onInit(canvas, res.width, res.height, canvasDpr);
        }
        else {
          this.triggerEvent('init', {
            canvas: canvas,
            width: res.width,
            height: res.height,
            canvasDpr: canvasDpr // 增加了dpr，可方便外面echarts.init
          });
        }
      }).exec();
    },

    initByNewWay(callback) {
      // version >= 2.9.0：使用新的方式初始化
      const query = wx.createSelectorQuery().in(this)
      query
        .select('.ec-canvas')
        .fields({ node: true, size: true })
        .exec(res => {
          const canvasNode = res[0].node
          this.canvasNode = canvasNode

          const canvasDpr = wx.getSystemInfoSync().pixelRatio
          const canvasWidth = res[0].width
          const canvasHeight = res[0].height

          const ctx = canvasNode.getContext('2d')

          const canvas = new WxCanvas(ctx, this.data.canvasId, true, canvasNode)
          if (echarts.setPlatformAPI) {
            echarts.setPlatformAPI({
              createCanvas: () => canvas,
              loadImage: (src, onload, onerror) => {
                if (canvasNode.createImage) {
                  const image = canvasNode.createImage();
                  image.onload = onload;
                  image.onerror = onerror;
                  image.src = src;
                  return image;
                }
                console.error('加载图片依赖 `Canvas.createImage()` API，要求小程序基础库版本在 2.7.0 及以上。');
                // PENDING fallback?
              }
            })
          } else {
            echarts.setCanvasCreator(() => canvas)
          }

          if (typeof callback === 'function') {
            this.chart = callback(canvas, canvasWidth, canvasHeight, canvasDpr)
          } else if (this.data.ec && typeof this.data.ec.onInit === 'function') {
            this.chart = this.data.ec.onInit(canvas, canvasWidth, canvasHeight, canvasDpr)
          } else {
            this.triggerEvent('init', {
              canvas: canvas,
              width: canvasWidth,
              height: canvasHeight,
              dpr: canvasDpr
            })
          }
        })
    },
    canvasToTempFilePath(opt) {
      if (this.data.isUseNewCanvas) {
        // 新版
        const query = wx.createSelectorQuery().in(this)
        query
          .select('.ec-canvas')
          .fields({ node: true, size: true })
          .exec(res => {
            const canvasNode = res[0].node
            opt.canvas = canvasNode
            wx.canvasToTempFilePath(opt)
          })
      } else {
        // 旧的
        if (!opt.canvasId) {
          opt.canvasId = this.data.canvasId;
        }
        ctx.draw(true, () => {
          wx.canvasToTempFilePath(opt, this);
        });
      }
    },

    /**
     * 双指缩放处理函数
     * 基于 touchStart 时的初始状态进行计算，避免高频调用 getOption()
     */
    zoomHandler: throttle(function(e) {
      if (!this.chart || !this.zoomContext) {
        return;
      }

      const [t0, t1] = e.touches;
      const curDis = getDistance(t0, t1);
      
      // 基于初始距离计算总缩放比
      const totalScale = curDis / this.zoomContext.initialDis;

      // 判断缩放方向（手指距离增大 = 放大图表 = 窗口变小）
      const isZoomingIn = totalScale > 1;
      
      // 智能灵敏度计算（基于初始窗口大小）
      const initialWindow = this.zoomContext.initialWindow;
      const sensitivity = isZoomingIn 
        ? Math.max(0.1, Math.pow(initialWindow / 100, 0.5) * 3)
        : Math.max(0.15, Math.pow(initialWindow / 100, 0.5) * 3);

      let scale = 1 + (totalScale - 1) * sensitivity;

      // 基于初始窗口计算新窗口（避免累积误差）
      let newWindow = this.zoomContext.initialWindow / scale;
      
      // 窗口大小限制（基于点数）
      const MIN_WINDOW = this.zoomContext.minWindowPercent || 1; // 最小10个点（或数据总长度）
      const MAX_WINDOW = this.zoomContext.maxWindowPercent || 100; // 最大300个点
      
      newWindow = Math.max(MIN_WINDOW, Math.min(MAX_WINDOW, newWindow));
      
      const windowCenter = this.zoomContext.initialWindowCenter;
      let newStart = windowCenter - newWindow / 2;
      let newEnd = windowCenter + newWindow / 2;

      // 边界处理：确保不超出 0-100 范围
      if (newStart < 0) {
        newStart = 0;
        newEnd = newWindow;
      }
      if (newEnd > 100) {
        newEnd = 100;
        newStart = 100 - newWindow;
      }

      this.chart.dispatchAction({
        type: 'dataZoom',
        dataZoomIndex: 0,
        start: newStart,
        end: newEnd
      });
    }, 100),

    touchStart(e) {
      if (this.chart) {
        var handler = this.chart.getZr().handler;
        if (e.touches.length === 1) {
          var touch = e.touches[0];
          handler.dispatch('mousedown', {
            zrX: touch.x,
            zrY: touch.y,
            preventDefault: () => {},
            stopImmediatePropagation: () => {},
            stopPropagation: () => {}
          });
          handler.dispatch('mousemove', {
            zrX: touch.x,
            zrY: touch.y,
            preventDefault: () => {},
            stopImmediatePropagation: () => {},
            stopPropagation: () => {}
          });
        } else if (e.touches.length === 2) {
          // 缓存初始缩放状态
          const option = this.chart.getOption();
          if (option.dataZoom && option.dataZoom.length > 0) {
            const dz = option.dataZoom[0];
            const initialWindow = dz.end - dz.start;
            
            // 获取数据总点数
            let totalPoints = 0;
            if (option.series && option.series.length > 0) {
              const seriesData = option.series[0].data;
              if (seriesData && seriesData.length > 0) {
                totalPoints = seriesData.length;
              }
            }
            
            // 数据少于10个点，禁用缩放
            if (totalPoints < 10) {
              return;
            }
            
            // 计算最小/最大显示点数
            const minPoints = 10; // 最小显示10个点
            const maxPoints = Math.min(300, totalPoints); // 最大显示300个点（不超过总数据）
            
            // 转换为百分比（用于 dataZoom）
            const minWindowPercent = (minPoints / totalPoints) * 100;
            const maxWindowPercent = (maxPoints / totalPoints) * 100;
            
            this.zoomContext = {
              initialDis: getDistance(e.touches[0], e.touches[1]),
              initialStart: dz.start,
              initialEnd: dz.end,
              initialWindow: initialWindow,
              initialWindowCenter: dz.start + initialWindow / 2,
              minWindowPercent: minWindowPercent,
              maxWindowPercent: maxWindowPercent,
              totalPoints: totalPoints,
              minPoints: minPoints,
              maxPoints: maxPoints
            };
          }
        }
      }
    },

    touchMove(e) {
      if (this.chart) {
        var handler = this.chart.getZr().handler;
        if (e.touches.length > 0) {
          if (e.touches.length === 1) {
            var touch = e.touches[0];
            handler.dispatch('mousemove', {
              zrX: touch.x,
              zrY: touch.y,
              preventDefault: () => { },
              stopImmediatePropagation: () => { },
              stopPropagation: () => { }
            });
          }
        }
        if (e.touches.length === 2) {
          this.zoomHandler(e)
        }
      }
    },

    touchEnd(e) {
      if (this.chart) {
        var handler = this.chart.getZr().handler;
        if (e.changedTouches && e.changedTouches.length === 1 && (!e.touches || e.touches.length <= 1)) {
          // 只在最后一根手指离开时分发 mouseup/click
          const touch = e.changedTouches[0];
          handler.dispatch('mouseup', {
            zrX: touch.x,
            zrY: touch.y,
            preventDefault: () => {},
            stopImmediatePropagation: () => {},
            stopPropagation: () => {}
          });
          handler.dispatch('click', {
            zrX: touch.x,
            zrY: touch.y,
            preventDefault: () => {},
            stopImmediatePropagation: () => {},
            stopPropagation: () => {}
          });
        }
        
        // 清理缩放上下文（释放内存）
        if (!e.touches || e.touches.length < 2) {
          this.zoomContext = null;
        }
      }
    }
  }
});

function wrapTouch(event) {
  for (let i = 0; i < event.touches.length; ++i) {
    const touch = event.touches[i];
    touch.offsetX = touch.x;
    touch.offsetY = touch.y;
  }
  return event;
}
