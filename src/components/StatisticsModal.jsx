import React, { useState, useEffect, useRef } from 'react'
import { X, Calendar, FileText, Download, ChevronLeft, ChevronRight, Search, Filter, BarChart3, PieChart, TrendingUp, Image } from 'lucide-react'
import socketManager from '../utils/socket'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js'
import { Bar, Pie, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
)

const StatisticsModal = ({ isOpen, onClose, isDarkMode }) => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [statisticsData, setStatisticsData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [showChart, setShowChart] = useState(false)
  const [chartType, setChartType] = useState('line') // 'line', 'stacked', 'bar', 'gantt'
  const chartRef = useRef(null)

  // 모달이 열릴 때 데이터 로드
  useEffect(() => {
    if (isOpen) {
      loadStatisticsData(startDate, endDate)
      setCurrentPage(1) // 새 데이터 로드 시 첫 페이지로 이동
    }
  }, [isOpen, startDate, endDate])

  // 검색 키워드가 변경될 때마다 필터링
  useEffect(() => {
    filterData()
    setCurrentPage(1) // 필터링 후 첫 페이지로 이동
  }, [statisticsData, searchKeyword])

  // 데이터 필터링 함수 (다중 키워드 검색)
  const filterData = () => {
    if (!searchKeyword.trim()) {
      setFilteredData(statisticsData)
      return
    }

    // 여러 구분자로 키워드 분리 (공백, 쉼표, 세미콜론)
    const keywords = searchKeyword
      .toLowerCase()
      .split(/[\s,;]+/)  // 공백, 쉼표, 세미콜론으로 분리
      .filter(k => k.trim().length > 0)
    
    // console.log('🔍 검색 키워드들:', keywords)
    
    const filtered = statisticsData.filter(patient => {
      // 상태를 한글로 변환
      const statusText = patient.status === 'waiting' ? '대기' : 
                        patient.status === 'procedure' ? '시술중' : 
                        patient.status === 'completed' ? '완료' : patient.status || ''
      
      // 검색 가능한 모든 필드들
      const searchFields = [
        patient.patient_id || '',
        patient.patient_name || '',
        patient.assigned_doctor || '',
        patient.doctor || '',
        patient.ward || '',
        patient.notes || '',
        patient.department || patient.room || '',
        patient.gender_age || '',
        statusText,
        patient.status || '',
        patient.priority ? patient.priority.toString() : '',
        patient.patient_date || '',
        patient.procedure_start_time || '',
        patient.wait_time ? patient.wait_time.toString() : ''
      ]
      
      // 날짜 필드들을 한국어 형식으로 추가
      if (patient.added_at) {
        try {
          searchFields.push(new Date(patient.added_at).toLocaleDateString('ko-KR'))
        } catch (e) {}
      }
      if (patient.created_at) {
        try {
          searchFields.push(new Date(patient.created_at).toLocaleDateString('ko-KR'))
        } catch (e) {}
      }
      
      // 모든 필드를 하나의 텍스트로 결합
      const searchableText = searchFields.join(' ').toLowerCase()
      
      // 모든 키워드가 포함되어야 함 (AND 검색)
      const matchesAll = keywords.every(keyword => 
        searchableText.includes(keyword)
      )
      
      return matchesAll
    })
    
    // console.log('🔍 검색 결과:', filtered.length, '명')
    setFilteredData(filtered)
  }

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentData = filteredData.slice(startIndex, endIndex)

  // 페이지 변경
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  // 페이지 범위 계산 (페이지네이션 버튼용)
  const getPageRange = () => {
    const delta = 2 // 현재 페이지 주변에 보여줄 페이지 수
    const range = []
    const rangeWithDots = []

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }

  // 통계 데이터 로드 (날짜 범위)
  const loadStatisticsData = async (start, end) => {
    setLoading(true)
    setError(null)
    try {
      // console.log('📊 통계 데이터 로드:', start, '~', end)
      
      // 날짜 범위 내의 모든 날짜에 대해 데이터 로드
      const startDateObj = new Date(start)
      const endDateObj = new Date(end)
      const allData = []
      
      for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        try {
          const dayData = await socketManager.fetchPatientsForDate(dateStr)
          if (dayData && dayData.length > 0) {
            allData.push(...dayData)
          }
        } catch (dayError) {
          console.warn('📅 날짜별 데이터 로드 실패:', dateStr, dayError)
        }
      }
      
      setStatisticsData(allData)
      setFilteredData(allData)
      // console.log('📊 통계 데이터 로드 완료:', allData.length, '명')
    } catch (err) {
      console.error('❌ 통계 데이터 로드 실패:', err)
      setError('통계 데이터를 불러오는데 실패했습니다.')
      setStatisticsData([])
      setFilteredData([])
    } finally {
      setLoading(false)
    }
  }

  // 차트 데이터 생성 함수들 - 검색/필터링된 데이터 기준
  const getLineChartData = () => {
    // 날짜별 환자 수 추이 (검색 결과 기준)
    const dailyCounts = {}
    
    filteredData.forEach(patient => {
      const date = patient.patient_date || new Date().toISOString().split('T')[0]
      dailyCounts[date] = (dailyCounts[date] || 0) + 1
    })

    const sortedDates = Object.keys(dailyCounts).sort()
    const labels = sortedDates.map(date => new Date(date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }))

    return {
      labels,
      datasets: [
        {
          label: '환자 수',
          data: sortedDates.map(date => dailyCounts[date] || 0),
          borderColor: isDarkMode ? '#60A5FA' : '#3B82F6',
          backgroundColor: isDarkMode ? '#60A5FA20' : '#3B82F620',
          tension: 0.4,
          fill: false,
          pointBackgroundColor: isDarkMode ? '#60A5FA' : '#3B82F6',
          pointBorderColor: isDarkMode ? '#FFFFFF' : '#000000',
          pointRadius: 4
        }
      ]
    }
  }

  const getStackedChartData = () => {
    // 의사별 키워드 분포 누적 차트
    const doctorKeywordCounts = {}
    
    // 검색 키워드를 기반으로 키워드 추출
    const extractKeywords = (patient) => {
      const keywords = []
      
      // 검색 키워드가 있으면 해당 키워드들을 사용
      if (searchKeyword) {
        const searchFields = [
          patient.patient_id || '',
          patient.patient_name || '',
          patient.assigned_doctor || '',
          patient.doctor || '',
          patient.ward || '',
          patient.notes || '',
          patient.department || patient.room || '',
          patient.gender_age || ''
        ].join(' ').toLowerCase()
        
        const searchKeywords = searchKeyword.toLowerCase().split(/[\s,;]+/).filter(k => k.trim())
        searchKeywords.forEach(keyword => {
          if (searchFields.includes(keyword)) {
            keywords.push(keyword)
          }
        })
      } else {
        // 검색 키워드가 없으면 시술명만 추출
        
        // 1. 시술명 (assigned_doctor 필드에서만)
        if (patient.assigned_doctor) {
          keywords.push(patient.assigned_doctor)
        }
        
        // 2. 비고에서 시술 관련 키워드만 추출
        if (patient.notes) {
          const procedureKeywords = ['응급', '급성', '재시술']
          procedureKeywords.forEach(keyword => {
            if (patient.notes.toLowerCase().includes(keyword)) {
              keywords.push(keyword)
            }
          })
        }
      }
      
      return [...new Set(keywords)] // 중복 제거
    }
    
    filteredData.forEach(patient => {
      const doctor = patient.doctor || patient.assigned_doctor || '미지정'
      const keywords = extractKeywords(patient)
      
      if (!doctorKeywordCounts[doctor]) {
        doctorKeywordCounts[doctor] = {}
      }
      
      // 키워드가 없으면 '기타'로 분류
      if (keywords.length === 0) {
        keywords.push('기타')
      }
      
      keywords.forEach(keyword => {
        doctorKeywordCounts[doctor][keyword] = (doctorKeywordCounts[doctor][keyword] || 0) + 1
      })
    })

    const doctors = Object.keys(doctorKeywordCounts)
    const allKeywords = [...new Set(
      Object.values(doctorKeywordCounts).flatMap(keywordCounts => Object.keys(keywordCounts))
    )]
    
    const datasets = allKeywords.map((keyword, index) => ({
      label: keyword.toUpperCase(),
      data: doctors.map(doctor => doctorKeywordCounts[doctor]?.[keyword] || 0),
      backgroundColor: [
        isDarkMode ? '#60A5FA' : '#3B82F6', // 파랑
        isDarkMode ? '#34D399' : '#10B981', // 초록
        isDarkMode ? '#F87171' : '#EF4444', // 빨강
        isDarkMode ? '#FBBF24' : '#F59E0B', // 노랑
        isDarkMode ? '#A78BFA' : '#8B5CF6', // 보라
        isDarkMode ? '#FB7185' : '#F43F5E', // 핑크
        isDarkMode ? '#38BDF8' : '#0EA5E9', // 하늘색
        isDarkMode ? '#4ADE80' : '#22C55E', // 라임
        isDarkMode ? '#FACC15' : '#EAB308', // 골드
        isDarkMode ? '#C084FC' : '#A855F7'  // 바이올렛
      ][index % 10],
      borderColor: isDarkMode ? '#374151' : '#FFFFFF',
      borderWidth: 1
    }))

    return {
      labels: doctors.map(doctor => 
        doctor.length > 8 ? doctor.substring(0, 8) + '...' : doctor
      ),
      datasets
    }
  }

  const getBarChartData = () => {
    // 날짜별 키워드 분포 막대 차트
    const dateKeywordCounts = {}
    
    // 검색 키워드를 기반으로 키워드 추출
    const extractKeywords = (patient) => {
      const searchFields = [
        patient.patient_id || '',
        patient.patient_name || '',
        patient.assigned_doctor || '',
        patient.doctor || '',
        patient.ward || '',
        patient.notes || '',
        patient.department || patient.room || '',
        patient.gender_age || ''
      ].join(' ').toLowerCase()
      
      // 검색 키워드가 있으면 해당 키워드들을 사용
      if (searchKeyword) {
        const keywords = searchKeyword.toLowerCase().split(/[\s,;]+/).filter(k => k.trim())
        return keywords.filter(keyword => searchFields.includes(keyword))
      }
      
      // 검색 키워드가 없으면 주요 시술명/상태 키워드 추출
      const commonKeywords = ['cag', 'pci', 'angio', 'cabg', 'stent', '응급', '대기', '시술', '완료']
      return commonKeywords.filter(keyword => searchFields.includes(keyword))
    }
    
    filteredData.forEach(patient => {
      const date = patient.patient_date || new Date().toISOString().split('T')[0]
      const keywords = extractKeywords(patient)
      
      if (!dateKeywordCounts[date]) {
        dateKeywordCounts[date] = {}
      }
      
      // 키워드가 없으면 '기타'로 분류
      if (keywords.length === 0) {
        keywords.push('기타')
      }
      
      keywords.forEach(keyword => {
        dateKeywordCounts[date][keyword] = (dateKeywordCounts[date][keyword] || 0) + 1
      })
    })

    const sortedDates = Object.keys(dateKeywordCounts).sort()
    const allKeywords = [...new Set(
      Object.values(dateKeywordCounts).flatMap(keywordCounts => Object.keys(keywordCounts))
    )]
    
    const datasets = allKeywords.map((keyword, index) => ({
      label: keyword.toUpperCase(),
      data: sortedDates.map(date => dateKeywordCounts[date]?.[keyword] || 0),
      backgroundColor: [
        isDarkMode ? '#60A5FA' : '#3B82F6', // 파랑
        isDarkMode ? '#34D399' : '#10B981', // 초록
        isDarkMode ? '#F87171' : '#EF4444', // 빨강
        isDarkMode ? '#FBBF24' : '#F59E0B', // 노랑
        isDarkMode ? '#A78BFA' : '#8B5CF6', // 보라
        isDarkMode ? '#FB7185' : '#F43F5E', // 핑크
        isDarkMode ? '#38BDF8' : '#0EA5E9', // 하늘색
        isDarkMode ? '#4ADE80' : '#22C55E', // 라림
        isDarkMode ? '#FACC15' : '#EAB308', // 골드
        isDarkMode ? '#C084FC' : '#A855F7'  // 바이올렛
      ][index % 10],
      borderColor: isDarkMode ? '#374151' : '#FFFFFF',
      borderWidth: 1
    }))

    return {
      labels: sortedDates.map(date => new Date(date).toLocaleDateString('ko-KR', { 
        month: '2-digit', 
        day: '2-digit' 
      })),
      datasets
    }
  }

  const getGanttChartData = () => {
    // 시술명별 케이스 수 (가로 막대 차트 스타일)
    const procedureCounts = {}
    
    filteredData.forEach(patient => {
      const procedure = patient.assigned_doctor || patient.procedure || '미지정'
      procedureCounts[procedure] = (procedureCounts[procedure] || 0) + 1
    })

    // 케이스 수 기준으로 정렬하여 상위 10개 선택
    const sortedProcedures = Object.entries(procedureCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)

    const procedures = sortedProcedures.map(([procedure]) => procedure)
    const counts = sortedProcedures.map(([, count]) => count)

    return {
      labels: procedures.map(procedure => 
        procedure.length > 12 ? procedure.substring(0, 12) + '...' : procedure
      ),
      datasets: [{
        label: '케이스 수',
        data: counts,
        backgroundColor: counts.map((count, index) => {
          // 케이스 수에 따라 색상 강도 조절
          const intensity = Math.min(count / Math.max(...counts), 1)
          const colors = [
            isDarkMode ? '#60A5FA' : '#3B82F6', // 파랑
            isDarkMode ? '#34D399' : '#10B981', // 초록
            isDarkMode ? '#F87171' : '#EF4444', // 빨강
            isDarkMode ? '#FBBF24' : '#F59E0B', // 노랑
            isDarkMode ? '#A78BFA' : '#8B5CF6', // 보라
            isDarkMode ? '#FB7185' : '#F43F5E', // 핑크
            isDarkMode ? '#38BDF8' : '#0EA5E9', // 하늘색
            isDarkMode ? '#4ADE80' : '#22C55E', // 라임
            isDarkMode ? '#FACC15' : '#EAB308', // 골드
            isDarkMode ? '#C084FC' : '#A855F7'  // 바이올렛
          ]
          const baseColor = colors[index % colors.length]
          // 투명도로 케이스 수 표현 (많을수록 진함)
          return baseColor + Math.floor(50 + intensity * 200).toString(16).padStart(2, '0')
        }),
        borderColor: isDarkMode ? '#374151' : '#FFFFFF',
        borderWidth: 1
      }]
    }
  }

  const getChartData = () => {
    switch (chartType) {
      case 'line': return getLineChartData()
      case 'stacked': return getStackedChartData()
      case 'bar': return getBarChartData()
      case 'gantt': return getGanttChartData()
      default: return getLineChartData()
    }
  }

  const getChartOptions = () => {
    const getChartTitle = () => {
      const totalCount = filteredData.length
      const searchText = searchKeyword ? ` (검색: "${searchKeyword}")` : ''
      
      switch (chartType) {
        case 'line': return `날짜별 환자 수 추이 (총 ${totalCount}명)${searchText}`
        case 'stacked': return `의사별 시술 분포 (총 ${totalCount}명)${searchText}`
        case 'bar': return `날짜별 키워드 분포 (총 ${totalCount}명)${searchText}`
        case 'gantt': return `시술명별 환자 분포 (총 ${totalCount}명)${searchText}`
        default: return `검색 결과 통계 (총 ${totalCount}명)${searchText}`
      }
    }

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: isDarkMode ? '#E5E7EB' : '#374151'
          }
        },
        title: {
          display: true,
          text: getChartTitle(),
          color: isDarkMode ? '#E5E7EB' : '#374151',
          font: { size: 16, weight: 'bold' }
        }
      }
    }

    // 스케일이 필요한 차트들
    if (['line', 'stacked', 'bar', 'gantt'].includes(chartType)) {
      const scaleOptions = {
        y: {
          beginAtZero: true,
          ticks: { 
            color: isDarkMode ? '#E5E7EB' : '#374151',
            stepSize: 1
          },
          grid: { color: isDarkMode ? '#374151' : '#E5E7EB' }
        },
        x: {
          ticks: { color: isDarkMode ? '#E5E7EB' : '#374151' },
          grid: { color: isDarkMode ? '#374151' : '#E5E7EB' }
        }
      }

      // 누적 차트 옵션
      if (chartType === 'stacked') {
        scaleOptions.y.stacked = true
        scaleOptions.x.stacked = true
      }

      // 간트 차트 옵션 - 케이스 수 표시
      if (chartType === 'gantt') {
        // Y축을 일반적인 숫자 스케일로 설정
        scaleOptions.y.ticks.callback = function(value) {
          return value + '건' // 케이스 수에 '건' 단위 추가
        }
      }

      return {
        ...baseOptions,
        scales: scaleOptions
      }
    }

    return baseOptions
  }

  // 이미지 다운로드 기능
  const downloadChart = (format = 'png') => {
    if (chartRef.current) {
      const canvas = chartRef.current.canvas
      const ctx = canvas.getContext('2d')
      
      // 라이트 모드일 때 배경을 흰색으로 설정
      if (!isDarkMode) {
        // 임시 캔버스 생성
        const tempCanvas = document.createElement('canvas')
        const tempCtx = tempCanvas.getContext('2d')
        tempCanvas.width = canvas.width
        tempCanvas.height = canvas.height
        
        // 흰색 배경 그리기
        tempCtx.fillStyle = '#ffffff'
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
        
        // 기존 차트 내용을 흰색 배경 위에 그리기
        tempCtx.drawImage(canvas, 0, 0)
        
        // 임시 캔버스에서 이미지 생성
        const url = tempCanvas.toDataURL(`image/${format}`, 0.9)
        const link = document.createElement('a')
        link.download = `환자통계_${chartType}_${startDate === endDate ? startDate : `${startDate}_to_${endDate}`}.${format}`
        link.href = url
        link.click()
      } else {
        // 다크 모드일 때는 기존 방식 사용
        const url = canvas.toDataURL(`image/${format}`, 0.9)
        const link = document.createElement('a')
        link.download = `환자통계_${chartType}_${startDate === endDate ? startDate : `${startDate}_to_${endDate}`}.${format}`
        link.href = url
        link.click()
      }
    }
  }

  // CSV 다운로드 기능
  const downloadCSV = () => {
    if (filteredData.length === 0) return

    const headers = ['#', '날짜', '환자등록번호', '환자이름', '시술명', '담당의사', '병동', '비고', '상태', '검사실']
    const csvContent = [
      headers.join(','),
      ...filteredData.map((patient, index) => [
        index + 1,
        `"${patient.patient_date || new Date().toISOString().split('T')[0]}"`,
        `"${patient.patient_id || ''}"`,
        `"${patient.patient_name || ''}"`,
        `"${patient.assigned_doctor || ''}"`,
        `"${patient.doctor || ''}"`,
        `"${patient.ward || ''}"`,
        `"${patient.notes || ''}"`,
        `"${patient.status === 'waiting' ? '대기' : patient.status === 'procedure' ? '시술중' : '완료'}"`,
        `"${patient.department || patient.room || ''}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    const dateRange = startDate === endDate ? startDate : `${startDate}_to_${endDate}`
    const filename = searchKeyword ? `환자통계_${dateRange}_${searchKeyword}.csv` : `환자통계_${dateRange}.csv`
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 상태별 색상 반환
  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting':
        return isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
      case 'procedure':
        return isDarkMode ? 'text-green-400' : 'text-green-600'
      case 'completed':
        return isDarkMode ? 'text-gray-400' : 'text-gray-600'
      default:
        return isDarkMode ? 'text-gray-300' : 'text-gray-700'
    }
  }

  // 상태 텍스트 반환
  const getStatusText = (status) => {
    switch (status) {
      case 'waiting': return '대기'
      case 'procedure': return '시술중'
      case 'completed': return '완료'
      default: return status
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`
        w-full max-w-6xl max-h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col
        ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}
      `}>
        {/* 헤더 */}
        <div className={`
          p-6 border-b
          ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}
        `}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-bold">전체 통계</h2>
            </div>
            
            <button
              onClick={onClose}
              onTouchEnd={(e) => {
                e.preventDefault()
                onClose()
              }}
              className={`
                p-2 rounded-lg transition-colors active:scale-95
                ${isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white' 
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }
              `}
              style={{ touchAction: 'manipulation' }}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* 검색 및 필터 영역 */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 검색 입력 */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="다중 키워드 검색 (예: CAG 대기 조준환, Angio,1R,시술중) - 공백/쉼표/세미콜론으로 구분"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className={`
                  flex-1 px-3 py-2 rounded-lg border text-sm
                  ${isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }
                `}
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword('')}
                  className={`
                    px-2 py-1 rounded text-xs transition-colors
                    ${isDarkMode 
                      ? 'text-gray-400 hover:text-white hover:bg-gray-600' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  초기화
                </button>
              )}
            </div>

            {/* 날짜 범위 선택 */}
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`
                  px-3 py-2 rounded-lg border text-sm
                  ${isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                `}
              />
              <span className="text-gray-500">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`
                  px-3 py-2 rounded-lg border text-sm
                  ${isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                `}
              />
            </div>

            {/* 페이지 크기 선택 */}
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className={`
                px-3 py-2 rounded-lg border text-sm
                ${isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
                }
              `}
            >
              <option value={5}>5개씩</option>
              <option value={10}>10개씩</option>
              <option value={20}>20개씩</option>
              <option value={50}>50개씩</option>
              <option value={100}>100개씩</option>
            </select>

            {/* 차트 토글 버튼 */}
            <button
              onClick={() => setShowChart(!showChart)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors active:scale-95
                ${showChart
                  ? (isDarkMode 
                    ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                    : 'bg-purple-500 hover:bg-purple-600 text-white')
                  : (isDarkMode 
                    ? 'bg-gray-600 hover:bg-gray-700 text-gray-300' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700')
                }
              `}
            >
              <BarChart3 className="w-4 h-4" />
              {showChart ? '테이블 보기' : '차트 보기'}
            </button>

            {/* CSV 다운로드 버튼 */}
            <button
              onClick={downloadCSV}
              disabled={filteredData.length === 0}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${filteredData.length > 0
                  ? (isDarkMode 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white')
                  : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                }
              `}
            >
              <Download className="w-4 h-4" />
              CSV 다운로드
            </button>
          </div>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 pb-0">
            {/* 요약 정보 */}
            {searchKeyword && (
              <div className="mb-4">
                {/* 검색 결과일 때만 검색 결과 표시 */}
                <div className={`
                  flex items-center justify-between p-3 rounded-lg border
                  ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-blue-50 border-blue-200'}
                `}>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-blue-500">{filteredData.length}</div>
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        검색 결과 (전체 {statisticsData.length}명)
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        키워드: "{searchKeyword}"
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {searchKeyword.split(/[\s,;]+/).filter(k => k.trim()).length}개 키워드
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 로딩 상태 */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-500">통계 데이터를 불러오는 중...</p>
              </div>
            </div>
          )}

          {/* 에러 상태 */}
          {error && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center text-red-500">
                <p className="text-lg font-medium mb-2">오류가 발생했습니다</p>
                <p className="text-sm">{error}</p>
                <button
                  onClick={() => loadStatisticsData(selectedDate)}
                  className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  다시 시도
                </button>
              </div>
            </div>
          )}

          {/* 차트 또는 테이블 영역 */}
          {!loading && !error && (
            <div className="flex-1 flex flex-col overflow-hidden px-6">
              {filteredData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-gray-500 text-lg">
                    {searchKeyword 
                      ? `"${searchKeyword}" 검색 결과가 없습니다.`
                      : '해당 날짜 범위에 등록된 환자가 없습니다.'
                    }
                  </p>
                </div>
              ) : (
                <>
                  {showChart ? (
                    /* 차트 영역 */
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* 차트 컨트롤 */}
                      <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">차트 유형:</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setChartType('line')}
                              className={`
                                px-3 py-1 text-xs rounded-lg font-medium transition-colors
                                ${chartType === 'line'
                                  ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                                  : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
                                }
                              `}
                            >
                              <TrendingUp className="w-3 h-3 inline mr-1" />
                              선그래프
                            </button>
                            <button
                              onClick={() => setChartType('stacked')}
                              className={`
                                px-3 py-1 text-xs rounded-lg font-medium transition-colors
                                ${chartType === 'stacked'
                                  ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                                  : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
                                }
                              `}
                            >
                              <BarChart3 className="w-3 h-3 inline mr-1" />
                              의사별분포
                            </button>
                            <button
                              onClick={() => setChartType('bar')}
                              className={`
                                px-3 py-1 text-xs rounded-lg font-medium transition-colors
                                ${chartType === 'bar'
                                  ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                                  : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
                                }
                              `}
                            >
                              <BarChart3 className="w-3 h-3 inline mr-1" />
                              막대그래프
                            </button>
                            <button
                              onClick={() => setChartType('gantt')}
                              className={`
                                px-3 py-1 text-xs rounded-lg font-medium transition-colors
                                ${chartType === 'gantt'
                                  ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                                  : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
                                }
                              `}
                            >
                              <PieChart className="w-3 h-3 inline mr-1" />
                              간트차트
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadChart('png')}
                            className={`
                              flex items-center gap-1 px-3 py-1 text-xs rounded-lg font-medium transition-colors
                              ${isDarkMode 
                                ? 'bg-green-600 hover:bg-green-700 text-white' 
                                : 'bg-green-500 hover:bg-green-600 text-white'
                              }
                            `}
                          >
                            <Image className="w-3 h-3" />
                            PNG
                          </button>
                          <button
                            onClick={() => downloadChart('jpeg')}
                            className={`
                              flex items-center gap-1 px-3 py-1 text-xs rounded-lg font-medium transition-colors
                              ${isDarkMode 
                                ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                                : 'bg-orange-500 hover:bg-orange-600 text-white'
                              }
                            `}
                          >
                            <Image className="w-3 h-3" />
                            JPG
                          </button>
                        </div>
                      </div>

                      {/* 차트 컨테이너 */}
                      <div className="flex-1 overflow-auto">
                        <div className="flex items-center justify-center p-4 min-h-[700px]">
                          <div className="w-full h-full max-w-6xl min-h-[650px]">
                          {chartType === 'line' ? (
                            <Line ref={chartRef} data={getChartData()} options={getChartOptions()} />
                          ) : chartType === 'stacked' ? (
                            <Bar ref={chartRef} data={getChartData()} options={getChartOptions()} />
                          ) : chartType === 'bar' ? (
                            <Bar ref={chartRef} data={getChartData()} options={getChartOptions()} />
                          ) : chartType === 'gantt' ? (
                            <Bar ref={chartRef} data={getChartData()} options={getChartOptions()} />
                          ) : (
                            <Line ref={chartRef} data={getChartData()} options={getChartOptions()} />
                          )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* 테이블 영역 */
                    <>
                      {/* 페이지네이션 정보 */}
                      <div className="flex items-center justify-between mb-4 flex-shrink-0">
                        <div className="text-sm text-gray-500">
                          {searchKeyword 
                            ? `"${searchKeyword}" 검색 결과: 총 ${filteredData.length}명 중 ${startIndex + 1}-${Math.min(endIndex, filteredData.length)}명 표시`
                            : `총 ${filteredData.length}명 중 ${startIndex + 1}-${Math.min(endIndex, filteredData.length)}명 표시`
                          }
                        </div>
                        <div className="text-sm text-gray-500">
                          페이지 {currentPage} / {totalPages}
                        </div>
                      </div>

                  {/* 테이블 컨테이너 - 스크롤 가능 영역 */}
                  <div className="flex-1 overflow-auto">
                    <div className={`
                      border rounded-lg overflow-hidden
                      ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}
                    `}>
                      <table className="w-full border-collapse">
                        <thead className={`
                          sticky top-0 z-10
                          ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}
                        `}>
                          <tr>
                            <th className={`px-4 py-3 text-center text-sm font-semibold border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} w-16`}>
                              #
                            </th>
                            <th className={`px-4 py-3 text-left text-sm font-semibold border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                              날짜
                            </th>
                            <th className={`px-4 py-3 text-left text-sm font-semibold border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                              환자등록번호
                            </th>
                            <th className={`px-4 py-3 text-left text-sm font-semibold border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                              환자이름
                            </th>
                            <th className={`px-4 py-3 text-left text-sm font-semibold border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                              시술명
                            </th>
                            <th className={`px-4 py-3 text-left text-sm font-semibold border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                              담당의사
                            </th>
                            <th className={`px-4 py-3 text-left text-sm font-semibold border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                              병동
                            </th>
                            <th className={`px-4 py-3 text-left text-sm font-semibold border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                              비고
                            </th>
                            <th className={`px-4 py-3 text-left text-sm font-semibold border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                              상태
                            </th>
                            <th className={`px-4 py-3 text-left text-sm font-semibold border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                              검사실
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentData.map((patient, index) => (
                            <tr
                              key={patient.id || index}
                              className={`
                                border-b transition-colors
                                ${isDarkMode 
                                  ? 'border-gray-700 hover:bg-gray-800' 
                                  : 'border-gray-200 hover:bg-gray-50'
                                }
                              `}
                            >
                              <td className={`px-4 py-3 text-center text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {(currentPage - 1) * itemsPerPage + index + 1}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {patient.patient_date ? new Date(patient.patient_date).toLocaleDateString('ko-KR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'
                                }) : new Date().toLocaleDateString('ko-KR', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'
                                })}
                              </td>
                              <td className="px-4 py-3 text-sm font-mono">
                                {patient.patient_id || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium">
                                {patient.patient_name || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {patient.assigned_doctor || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {patient.doctor || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {patient.ward || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm max-w-xs truncate" title={patient.notes}>
                                {patient.notes || '-'}
                              </td>
                              <td className={`px-4 py-3 text-sm font-medium ${getStatusColor(patient.status)}`}>
                                {getStatusText(patient.status)}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {patient.department || patient.room || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 페이지네이션 컨트롤 - 하단 고정 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center mt-4 gap-2 flex-shrink-0 pb-6">
                      {/* 이전 페이지 버튼 */}
                      <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`
                          flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                          ${currentPage === 1
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : (isDarkMode 
                              ? 'bg-gray-700 text-white hover:bg-gray-600' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                          }
                        `}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        이전
                      </button>

                      {/* 페이지 번호 버튼들 */}
                      {getPageRange().map((page, index) => (
                        <button
                          key={index}
                          onClick={() => typeof page === 'number' && goToPage(page)}
                          disabled={typeof page !== 'number'}
                          className={`
                            px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-[40px]
                            ${typeof page !== 'number'
                              ? 'cursor-default text-gray-400'
                              : page === currentPage
                                ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                                : (isDarkMode 
                                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                            }
                          `}
                        >
                          {page}
                        </button>
                      ))}

                      {/* 다음 페이지 버튼 */}
                      <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`
                          flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                          ${currentPage === totalPages
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : (isDarkMode 
                              ? 'bg-gray-700 text-white hover:bg-gray-600' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                          }
                        `}
                      >
                        다음
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StatisticsModal
