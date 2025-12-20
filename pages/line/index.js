import * as echarts from '../../ec-canvas/echarts';

const app = getApp();

function initChart(canvas, width, height, dpr) {
	const mockLength = 10000
	const mockData = Array.from({length: mockLength}).map(()=>({
		A: Math.random() * 10 - 5,
		B: Math.random() * 10 - 5,
		C: Math.random() * 10 - 5,
	}))
	const AData = mockData.map((d)=>d.A)
	const BData = mockData.map((d)=>d.B)
	const CData = mockData.map((d)=>d.C)
	const xData = mockData.map((_,i)=>i)

  const chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: dpr // new
  });
  canvas.setChart(chart);

  var option = {
    title: {
      text: '测试下面legend的红色区域不应被裁剪',
      left: 'center'
		},
		dataZoom:[
			{
        show: true,
        type: 'slider',
        showDetail: false,
        startValue: 0,
        endValue: 50,
        filterMode: 'empty',
        bottom: 0
      },
      {
				type: 'inside',
				filterMode: 'filter',
				animation: false
      }
		],
    legend: {
      data: ['A', 'B', 'C'],
      top: 50,
      left: 'center',
      backgroundColor: 'red',
      z: 100
    },
    grid: {
      containLabel: true
    },
    tooltip: {
      show: true,
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data:xData ,
    },
    yAxis: {
      x: 'center',
      type: 'value',
      splitLine: {
        lineStyle: {
          type: 'dashed'
        }
      }
    },
    series: [{
      name: 'A',
      type: 'line',
			smooth: true,
			data: AData
    }, {
      name: 'B',
      type: 'line',
			smooth: true,
			data: BData
    }, {
      name: 'C',
      type: 'line',
			smooth: true,
			data: CData
    }]
  };

  chart.setOption(option);
  return chart;
}

Page({
  onShareAppMessage: function (res) {
    return {
      title: 'ECharts 可以在微信小程序中使用啦！',
      path: '/pages/index/index',
      success: function () { },
      fail: function () { }
    }
  },
  data: {
    ec: {
      onInit: initChart
    }
  },

  onReady() {
  }
});
