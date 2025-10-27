import React, { useState, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { Clock, Users, Bell, Settings, Lock, Unlock, Eye, EyeOff, LogOut, Sun, Moon, Calendar, BarChart3, Upload } from 'lucide-react'
import PatientQueue from './PatientQueue'
import CurrentTime from './CurrentTime'
import DoctorSchedule from './DoctorStatus'
import PatientSummary from './PatientSummary'
import StatisticsModal from './StatisticsModal'
import socketManager from '../utils/socket'
import * as XLSX from 'xlsx'

const HospitalBoard = ({ user, onLogout }) => {

  const [isAdminMode, setIsAdminMode] = useState(false)
  const [isPrivacyMode, setIsPrivacyMode] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(true)
  // 현지 시간 기준으로 오늘 날짜 가져오기 (시간대 문제 해결)
  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const result = `${year}-${month}-${day}`
    return result
  }
  
  const [selectedDate, setSelectedDate] = useState(() => {
    // localStorage에서 저장된 날짜 확인
    const savedDate = localStorage.getItem('selectedDate');
    const today = getTodayDate();
    
    if (savedDate) {
      console.log('🏁 localStorage에서 selectedDate 복원:', savedDate);
      return savedDate;
    } else {
      console.log('🏁 초기 selectedDate 설정:', today);
      return today;
    }
  }) // YYYY-MM-DD 형식
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showStatistics, setShowStatistics] = useState(false)
  const [allPatients, setAllPatients] = useState({}) // 날짜별 환자 데이터 저장

  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [stats, setStats] = useState({})
  const [schedule, setSchedule] = useState({})
  const [error, setError] = useState(null)
  const [editingPatientId, setEditingPatientId] = useState(null) // 편집 중인 환자 ID 추적

  // 날짜별 환자 데이터 로드 (useCallback으로 최적화)
  const loadPatientsForDate = useCallback(async (date) => {
    try {
      console.log('📅 날짜별 환자 데이터 로드 시작:', date);
      
      // 먼저 서버에서 최신 데이터를 가져오기 시도
      let patientsData = [];
      try {
        patientsData = await socketManager.fetchPatientsForDate(date);
        console.log('📡 서버에서 환자 데이터 로드:', patientsData?.length || 0, '명');
        
        if (patientsData && Array.isArray(patientsData) && patientsData.length > 0) {
          // 서버에서 받은 데이터를 날짜별로 필터링
          const filteredData = patientsData.filter(p => 
            p.patient_date === date || (!p.patient_date && date === getTodayDate())
          );
          
          console.log('✅ 서버 데이터 필터링 후:', filteredData.length, '명');
          setPatients(filteredData);
          setAllPatients(prev => ({ ...prev, [date]: filteredData }));
          
          // 로컬 스토리지에 저장
          localStorage.setItem(`patients_${date}`, JSON.stringify(filteredData));
          return;
        }
      } catch (serverError) {
        console.warn('⚠️ 서버에서 환자 데이터 로드 실패:', serverError);
      }
      
      // 서버에서 데이터를 가져올 수 없으면 로컬 스토리지에서 확인
      const localKey = `patients_${date}`;
      const localData = localStorage.getItem(localKey);
      
      if (localData) {
        const parsedData = JSON.parse(localData);
        console.log('💾 로컬에서 환자 데이터 로드:', parsedData.length, '명');
        
        // 로컬 데이터도 날짜별로 필터링 (안전장치)
        const filteredLocalData = parsedData.filter(p => 
          p.patient_date === date || (!p.patient_date && date === getTodayDate())
        );
        
        console.log('🔍 로컬 데이터 날짜 필터링 후:', filteredLocalData.length, '명');
        setPatients(filteredLocalData);
        setAllPatients(prev => ({ ...prev, [date]: filteredLocalData }));
      } else {
        console.log('❌ 해당 날짜의 환자 데이터 없음:', date);
        setPatients([]);
        setAllPatients(prev => ({ ...prev, [date]: [] }));
      }
    } catch (error) {
      console.error('❌ 날짜별 환자 데이터 로드 실패:', error);
      setPatients([]);
    }
  }, []) // 의존성 없음 - 순수 함수

  // 현재 날짜의 환자 데이터를 로컬 스토리지에 저장
  const savePatientsForDate = (date, patientsData) => {
    try {
      const localKey = `patients_${date}`
      localStorage.setItem(localKey, JSON.stringify(patientsData))
    } catch (error) {
      console.error('❌ 환자 데이터 저장 실패:', error)
    }
  }

  // 테마 변경 시 body에 data-theme 속성 설정
  useEffect(() => {
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);


  // 선택된 날짜가 변경될 때 해당 날짜의 환자 데이터와 당직 정보 로드
  useEffect(() => {
    console.log('📅 useEffect: 선택된 날짜 변경됨 →', selectedDate)
    loadPatientsForDate(selectedDate)
  }, [selectedDate, loadPatientsForDate])
  
  // selectedDate 변경 감지용 디버깅 useEffect 및 localStorage 저장
  useEffect(() => {
    console.log('🎯 selectedDate 상태 변경 감지:', selectedDate)
    // localStorage에 저장
    localStorage.setItem('selectedDate', selectedDate);
    console.log('💾 selectedDate localStorage에 저장:', selectedDate)
  }, [selectedDate])

  // 환자 데이터가 변경될 때마다 현재 선택된 날짜에 저장 (무한 루프 방지)
  useEffect(() => {
    // 환자 데이터가 실제로 있거나 빈 배열일 때만 저장 (undefined는 제외)
    if (patients !== undefined && Array.isArray(patients)) {
      savePatientsForDate(selectedDate, patients)
      setAllPatients(prev => ({ ...prev, [selectedDate]: patients }))
    }
  }, [patients, selectedDate])


  // 외부 클릭시 달력 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDatePicker && !event.target.closest('.date-picker-container')) {
        setShowDatePicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDatePicker])

  // 컴포넌트 마운트 시 데이터 로드 및 소켓 이벤트 설정
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // 중앙 서버에서만 데이터 로드
        console.log('🚀 초기 데이터 로드 시작');
        
        // 환자 데이터도 함께 로드 (오늘 날짜)
        const todayDate = getTodayDate();
        const [doctorsData, statsData, scheduleData, patientsData] = await Promise.all([
          socketManager.fetchDoctors(),
          socketManager.fetchStats(),
          socketManager.fetchSchedule(),
          socketManager.fetchPatientsForDate(todayDate)
        ]);
        
        console.log('📋 초기 환자 데이터 로드 완료:', patientsData?.length || 0, '명');

        setDoctors(doctorsData || []);
        setStats(statsData || {});
        
        // 환자 데이터 설정
        if (patientsData && Array.isArray(patientsData)) {
          setPatients(patientsData);
          // 로컬 스토리지에도 저장
          localStorage.setItem(`patients_${todayDate}`, JSON.stringify(patientsData));
        } else {
          setPatients([]);
        }
        
        // 스케줄 데이터 처리 (빈 객체면 기본 구조 생성)
        if (scheduleData && Object.keys(scheduleData).length > 0) {
          setSchedule(scheduleData);
        } else {
          const defaultSchedule = {
            월: { 오전: ['김영상', '이영상', '박민수'], 오후: ['박영상', '최영상', '정현우'] },
            화: { 오전: ['이영상', '박영상', '강지연'], 오후: ['김영상', '정영상', '윤서준'] },
            수: { 오전: ['박영상', '최영상', '장하늘'], 오후: ['이영상', '김영상', '조예린'] },
            목: { 오전: ['최영상', '정영상', '김철수'], 오후: ['박영상', '이영상', '이영희'] },
            금: { 오전: ['정영상', '김영상', '최수진'], 오후: ['최영상', '박영상', '박민수'] }
          };
          setSchedule(defaultSchedule);
          
          // 기본 스케줄을 서버에 저장 (지연 실행으로 안전하게)
          setTimeout(() => {
            updateSchedule(defaultSchedule);
          }, 1000);
        }
        
        // API 데이터 로드 완료
      } catch (error) {
        console.error('중앙 서버 데이터 로드 실패:', error);
        console.error('에러 상세:', error.stack);
        // 에러 상태를 설정하지 않고 기본값으로 계속 진행
        console.warn('⚠️ 서버 연결 실패했지만 로컬 데이터로 계속 진행');
        setDoctors([]);
        setStats({});
        setSchedule({});
        
        // 백엔드 연결 실패 시 로컬 백업 데이터 사용
        try {
          const backupPatients = localStorage.getItem('hospitalPatients_backup');
          const backupDoctors = localStorage.getItem('hospitalDoctors_backup');
          const backupStats = localStorage.getItem('hospitalStats_backup');
          const backupSchedule = localStorage.getItem('hospitalSchedule_backup');
          
          if (backupPatients && backupPatients !== 'null') {
            const parsedPatients = JSON.parse(backupPatients);
            if (parsedPatients && parsedPatients.length > 0) {
              console.log('🔍 로컬 백업 환자 데이터 복원:', parsedPatients);
              
              // 담당의사와 시술명 필드 확인
              parsedPatients.forEach(patient => {
                console.log(`환자 ${patient.patient_name}: 시술명=${patient.assigned_doctor}, 담당의사=${patient.doctor}`);
              });
              
              setPatients(parsedPatients);
            } else {
              console.log('로컬 백업 환자 데이터가 비어있음');
              setPatients([]);
            }
          } else {
            console.log('로컬 백업 환자 데이터 없음');
            setPatients([]);
          }
          
          if (backupDoctors && backupDoctors !== 'null') {
            const parsedDoctors = JSON.parse(backupDoctors);
            if (parsedDoctors && parsedDoctors.length > 0) {
              console.log('로컬 백업 의사 데이터 복원:', parsedDoctors);
              setDoctors(parsedDoctors);
            } else {
              // 기본 의사 데이터 설정
              const defaultDoctors = [
                { id: 1, name: '김철수', department: 'Angio 1R', status: 'available' },
                { id: 2, name: '이영희', department: 'Angio 2R', status: 'available' },
                { id: 3, name: '박민수', department: 'Hybrid Room', status: 'available' }
              ];
              setDoctors(defaultDoctors);
            }
          } else {
            // 기본 의사 데이터 설정
            const defaultDoctors = [
              { id: 1, name: '김철수', department: 'Angio 1R', status: 'available' },
              { id: 2, name: '이영희', department: 'Angio 2R', status: 'available' },
              { id: 3, name: '박민수', department: 'Hybrid Room', status: 'available' }
            ];
            setDoctors(defaultDoctors);
          }
          
          if (backupStats && backupStats !== 'null') {
            const parsedStats = JSON.parse(backupStats);
            console.log('로컬 백업 통계 데이터 복원:', parsedStats);
            setStats(parsedStats);
          } else {
            setStats({ total_patients: 0, waiting_patients: 0, in_treatment: 0, completed_today: 0 });
          }

          if (backupSchedule && backupSchedule !== 'null') {
            const parsedSchedule = JSON.parse(backupSchedule);
            console.log('📅 로컬 백업 스케줄 데이터 복원:', parsedSchedule);
            setSchedule(parsedSchedule);
          } else {
            console.log('📅 로컬 백업 스케줄 데이터 없음, 기본 구조 생성');
            const defaultSchedule = {
              월: { 오전: ['김영상', '이영상', '박민수'], 오후: ['박영상', '최영상', '정현우'] },
              화: { 오전: ['이영상', '박영상', '강지연'], 오후: ['김영상', '정영상', '윤서준'] },
              수: { 오전: ['박영상', '최영상', '장하늘'], 오후: ['이영상', '김영상', '조예린'] },
              목: { 오전: ['최영상', '정영상', '김철수'], 오후: ['박영상', '이영상', '이영희'] },
              금: { 오전: ['정영상', '김영상', '최수진'], 오후: ['최영상', '박영상', '박민수'] }
            };
            setSchedule(defaultSchedule);
          }
          
          console.log('✅ 로컬 백업 데이터 복원 완료 (스케줄 포함)');
        } catch (backupError) {
          console.error('로컬 백업 데이터 복원 실패:', backupError);
          // 백업도 실패하면 기본 상태로 시작
          setPatients([]);
          const defaultDoctors = [
            { id: 1, name: '김철수', department: 'Angio 1R', status: 'available' },
            { id: 2, name: '이영희', department: 'Angio 2R', status: 'available' },
            { id: 3, name: '박민수', department: 'Hybrid Room', status: 'available' }
          ];
          setDoctors(defaultDoctors);
          setStats({ total_patients: 0, waiting_patients: 0, in_treatment: 0, completed_today: 0 });
          
          // 기본 스케줄 설정
          const defaultSchedule = {
            월: { 오전: ['김영상', '이영상', '박민수'], 오후: ['박영상', '최영상', '정현우'] },
            화: { 오전: ['이영상', '박영상', '강지연'], 오후: ['김영상', '정영상', '윤서준'] },
            수: { 오전: ['박영상', '최영상', '장하늘'], 오후: ['이영상', '김영상', '조예린'] },
            목: { 오전: ['최영상', '정영상', '김철수'], 오후: ['박영상', '이영상', '이영희'] },
            금: { 오전: ['정영상', '김영상', '최수진'], 오후: ['최영상', '박영상', '박민수'] }
          };
          setSchedule(defaultSchedule);
        }
        
        // 에러는 설정하지 않음 (로컬 백업으로 동작)
        // setError(error.message);
      }
    };

    // 실시간 이벤트 리스너 설정
    const setupSocketListeners = () => {
      // 환자 데이터 업데이트
      socketManager.on('patients_data', (data) => {
        // 최신 selectedDate를 가져오기 위해 함수형 접근
        const currentSelectedDate = localStorage.getItem('selectedDate') || getTodayDate();
        console.log('📡 patients_data 이벤트 수신:', {
          'data.length': data?.length || 0,
          'selectedDate(state)': selectedDate,
          'selectedDate(localStorage)': currentSelectedDate,
          'getTodayDate()': getTodayDate()
        });
        
        // 🔥 모든 환자 데이터를 날짜별로 로컬 스토리지에 저장하고 현재 선택된 날짜 데이터만 UI에 표시
        if (data && Array.isArray(data)) {
          const patientsByDate = {};
          
          data.forEach(patient => {
            const patientDate = patient.patient_date || getTodayDate();
            if (!patientsByDate[patientDate]) {
              patientsByDate[patientDate] = [];
            }
            patientsByDate[patientDate].push(patient);
          });
          
          console.log('📅 날짜별 환자 분류:', Object.keys(patientsByDate).map(date => 
            `${date}: ${patientsByDate[date].length}명`
          ).join(', '));
          
          // 각 날짜별로 로컬 스토리지에 저장
          Object.keys(patientsByDate).forEach(date => {
            localStorage.setItem(`patients_${date}`, JSON.stringify(patientsByDate[date]));
          });
          
          // 현재 선택된 날짜의 환자 데이터만 UI에 표시 (localStorage에서 최신 날짜 사용)
          const currentDatePatients = patientsByDate[currentSelectedDate] || [];
          console.log(`🎯 현재 선택된 날짜(${currentSelectedDate})의 환자:`, currentDatePatients.length, '명');
          
          setPatients(currentDatePatients);
          setAllPatients(prev => ({ ...prev, [currentSelectedDate]: currentDatePatients }));
        }
        
        // 아래 기존 복잡한 로직은 더 이상 사용하지 않음
        /*
        setPatients(prev => {
            const tempPatients = prev.filter(p => p.id > 1000000000000);
            const nonTempPatients = prev.filter(p => p.id <= 1000000000000);
            
            // 임시 환자가 있는 경우, 이름/번호로 매칭하여 교체
            let updatedPatients = [...nonTempPatients];
            
            tempPatients.forEach(tempPatient => {
              const matchingServerPatient = filteredData.find(serverPatient => 
                serverPatient.patient_name === tempPatient.patient_name && 
                serverPatient.patient_id === tempPatient.patient_id
              );
              
              if (matchingServerPatient) {
                updatedPatients.push(matchingServerPatient);
              } else {
                updatedPatients.push(tempPatient);
              }
            });
            
            return updatedPatients;
          });
        }
        */
      });

      socketManager.on('patient_updated', (updatedPatient) => {
        console.log('🔄 환자 상태 업데이트:', updatedPatient);
        setPatients(prev => {
          const updated = prev.map(patient => 
            patient.id === updatedPatient.id ? { ...patient, ...updatedPatient } : patient
          );
          console.log('✅ 로컬 상태 업데이트 완료');
          return updated;
        });
      });

      socketManager.on('patient_added', (newPatient) => {
        console.log('🎯 새 환자 실시간 수신:', newPatient);
        
        // 날짜 필터링: 현재 선택된 날짜와 일치하는 환자만 추가
        console.log('🔍 날짜 필터링 체크:', {
          'newPatient.patient_date': newPatient.patient_date,
          'selectedDate': selectedDate,
          'getTodayDate()': getTodayDate(),
          '일치여부': newPatient.patient_date === selectedDate
        });
        
        if (newPatient.patient_date !== selectedDate && !(newPatient.patient_date === null && selectedDate === getTodayDate())) {
          console.log('📅 다른 날짜 환자 - 현재 화면에 추가하지 않음:', newPatient.patient_date, '≠', selectedDate);
          return;
        }
        
        // 중복 방지: 이미 존재하는 환자인지 확인 (실제 ID와 임시 ID 모두 체크)
        setPatients(prev => {
          const existsById = prev.some(patient => patient.id === newPatient.id);
          const existsByNameAndNumber = prev.some(patient => 
            patient.patient_name === newPatient.patient_name && 
            patient.patient_id === newPatient.patient_id &&
            patient.id > 1000000000000 // 임시 ID인 경우
          );
          
          if (existsById) {
            console.log('⚠️ 동일 ID 환자 존재 - 추가 생략:', newPatient.id);
            return prev;
          }
          
          if (existsByNameAndNumber) {
            console.log('🔄 임시 환자를 실제 환자로 업데이트:', newPatient.patient_name);
            console.log('📋 서버에서 받은 실제 환자 데이터:', {
              notes: newPatient.notes,
              gender_age: newPatient.gender_age, 
              ward: newPatient.ward
            });
            // 임시 환자를 실제 환자 데이터로 업데이트 (제거하지 않고 교체)
            return prev.map(p => {
              if (p.patient_name === newPatient.patient_name && p.patient_id === newPatient.patient_id && p.id > 1000000000000) {
                console.log('🔄 임시 환자 업데이트:', p.id, '→', newPatient.id);
                return { ...newPatient }; // 실제 환자 데이터로 완전 교체
              }
              return p;
            });
          }
          
          console.log('✅ 새 환자 추가됨:', newPatient);
          return [...prev, newPatient];
        });
      });

      socketManager.on('patient_deleted', (deletedPatient) => {
        console.log('🗑️ 환자 삭제 실시간 수신:', deletedPatient);
        setPatients(prev => prev.filter(patient => patient.id !== deletedPatient.id));
      });

      // 실시간 환자 정보 업데이트 수신
      socketManager.on('patient_name_updated', (data) => {
        console.log('🎯 환자 이름 실시간 업데이트 수신:', data);
        // 편집 중인 환자는 업데이트 건너뛰기 (포커스 유지)
        if (editingPatientId === data.patientId) {
          console.log('⏸️ 편집 중인 환자 - 실시간 업데이트 건너뛰기:', data.patientId);
          return;
        }
        console.log('🔄 현재 환자 목록 업데이트 중...');
        setPatients(prev => {
          const updated = prev.map(patient => 
            patient.id === data.patientId ? { ...patient, patient_name: data.newName } : patient
          );
          console.log('✅ 환자 목록 업데이트 완료:', updated);
          return updated;
        });
      });

      socketManager.on('patient_number_updated', (data) => {
        console.log('환자 번호 실시간 업데이트 수신:', data);
        // 편집 중인 환자는 업데이트 건너뛰기 (포커스 유지)
        if (editingPatientId === data.patientId) {
          console.log('⏸️ 편집 중인 환자 - 실시간 업데이트 건너뛰기:', data.patientId);
          return;
        }
        setPatients(prev => prev.map(patient => 
          patient.id === data.patientId ? { ...patient, patient_id: data.newNumber } : patient
        ));
      });

      socketManager.on('patient_procedure_updated', (data) => {
        console.log('🏥 시술명 실시간 업데이트:', data);
        // 편집 중인 환자는 업데이트 건너뛰기 (포커스 유지)
        if (editingPatientId === data.patientId) {
          console.log('⏸️ 편집 중인 환자 - 실시간 업데이트 건너뛰기:', data.patientId);
          return;
        }
        setPatients(prev => {
          const updated = prev.map(patient => {
            if (patient.id === data.patientId) {
              console.log(`📝 환자 ${patient.patient_name} 시술명 실시간 업데이트: ${patient.assigned_doctor} → ${data.newProcedure}`);
              return { ...patient, assigned_doctor: data.newProcedure, procedure: data.newProcedure };
            }
            return patient;
          });
          console.log('✅ 시술명 로컬 상태 업데이트 완료');
          return updated;
        });
      });

      socketManager.on('patient_doctor_updated', (data) => {
        console.log('👨‍⚕️ 담당의사 실시간 업데이트:', data);
        // 편집 중인 환자는 업데이트 건너뛰기 (포커스 유지)
        if (editingPatientId === data.patientId) {
          console.log('⏸️ 편집 중인 환자 - 실시간 업데이트 건너뛰기:', data.patientId);
          return;
        }
        setPatients(prev => {
          const updated = prev.map(patient => 
            patient.id === data.patientId ? { ...patient, doctor: data.newDoctor } : patient
          );
          console.log('✅ 담당의사 로컬 상태 업데이트 완료');
          return updated;
        });
      });

      socketManager.on('patient_notes_updated', (data) => {
        console.log('📝 비고 실시간 업데이트:', data);
        // 편집 중인 환자는 업데이트 건너뛰기 (포커스 유지)
        if (editingPatientId === data.patientId) {
          console.log('⏸️ 편집 중인 환자 - 실시간 업데이트 건너뛰기:', data.patientId);
          return;
        }
        setPatients(prev => {
          const updated = prev.map(patient => 
            patient.id === data.patientId ? { ...patient, notes: data.newNotes } : patient
          );
          console.log('✅ 비고 로컬 상태 업데이트 완료');
          return updated;
        });
      });

      socketManager.on('patient_gender_age_updated', (data) => {
        console.log('👤 성별/나이 실시간 업데이트:', data);
        // 편집 중인 환자는 업데이트 건너뛰기 (포커스 유지)
        if (editingPatientId === data.patientId) {
          console.log('⏸️ 편집 중인 환자 - 실시간 업데이트 건너뛰기:', data.patientId);
          return;
        }
        setPatients(prev => {
          const updated = prev.map(patient => 
            patient.id === data.patientId ? { ...patient, gender_age: data.newGenderAge } : patient
          );
          console.log('✅ 성별/나이 로컬 상태 업데이트 완료');
          return updated;
        });
      });

      socketManager.on('patient_ward_updated', (data) => {
        console.log('🏥 병동 실시간 업데이트:', data);
        // 편집 중인 환자는 업데이트 건너뛰기 (포커스 유지)
        if (editingPatientId === data.patientId) {
          console.log('⏸️ 편집 중인 환자 - 실시간 업데이트 건너뛰기:', data.patientId);
          return;
        }
        setPatients(prev => {
          const updated = prev.map(patient => 
            patient.id === data.patientId ? { ...patient, ward: data.newWard } : patient
          );
          console.log('✅ 병동 로컬 상태 업데이트 완료');
          return updated;
        });
      });

      socketManager.on('patient_room_moved', (data) => {
        console.log('🏠 환자 방 이동 실시간 업데이트:', data);
        setPatients(prev => {
          const updated = prev.map(patient => 
            patient.id === data.patientId ? { ...patient, department: data.newRoom, room: data.newRoom } : patient
          );
          console.log('✅ 환자 방 이동 로컬 상태 업데이트 완료');
          return updated;
        });
      });

      // 외래 진료 스케줄 실시간 업데이트
      socketManager.on('schedule_updated', (updatedSchedule) => {
        console.log('📅 스케줄 실시간 업데이트 수신:', updatedSchedule);
        setSchedule(updatedSchedule);
        console.log('✅ 스케줄 로컬 상태 업데이트 완료');
      });

      // 의사 데이터 업데이트
      socketManager.on('doctors_data', (data) => {
        setDoctors(data);
      });

      socketManager.on('doctor_updated', (updatedDoctor) => {
        setDoctors(prev => prev.map(doctor => 
          doctor.id === updatedDoctor.id ? { ...doctor, ...updatedDoctor } : doctor
        ));
      });

      // 통계 데이터 업데이트
      socketManager.on('stats_data', (data) => {
        setStats(data);
      });

      socketManager.on('stats_updated', (data) => {
        setStats(data);
      });


      // 클라이언트 활동 전송
      socketManager.on('connect', () => {
        socketManager.emit('client_activity', {
          type: 'page_load',
          timestamp: new Date(),
          userAgent: navigator.userAgent
        });
      });
    };

    loadInitialData();
    setupSocketListeners();

    return () => {
      // 컴포넌트 언마운트 시 리스너 제거
      socketManager.off('patients_data');
      socketManager.off('patient_updated');
      socketManager.off('patient_added');
      socketManager.off('patient_deleted');
      socketManager.off('patient_name_updated');
      socketManager.off('patient_number_updated');
      socketManager.off('patient_procedure_updated');
      socketManager.off('patient_doctor_updated');
      socketManager.off('patient_room_moved');
      socketManager.off('schedule_updated');
      socketManager.off('doctors_data');
      socketManager.off('doctor_updated');
      socketManager.off('stats_data');
      socketManager.off('stats_updated');
      socketManager.off('duty_updated');
      socketManager.off('duty_schedule_updated');
      socketManager.off('connect');
      socketManager.off('disconnect');
      socketManager.off('connect_error');
    };
  }, []);

  // 로컬 상태 관리 (백엔드 서버 연결 실패 시 대비)
  useEffect(() => {
    // 상태가 변경될 때마다 즉시 백업 (빈 배열은 저장하지 않음)
    if (patients && patients.length > 0) {
      localStorage.setItem('hospitalPatients_backup', JSON.stringify(patients));
      
      // 담당의사와 시술명 필드 확인
      patients.forEach(patient => {
        // 로그 제거됨
      });
    }
  }, [patients]);

  useEffect(() => {
    if (doctors && doctors.length > 0) {
      localStorage.setItem('hospitalDoctors_backup', JSON.stringify(doctors));
    }
  }, [doctors]);

  useEffect(() => {
    if (stats && Object.keys(stats).length > 0) {
      localStorage.setItem('hospitalStats_backup', JSON.stringify(stats));
    }
  }, [stats]);

  useEffect(() => {
    if (schedule && Object.keys(schedule).length > 0) {
      localStorage.setItem('hospitalSchedule_backup', JSON.stringify(schedule));
    }
  }, [schedule]);

  useEffect(() => {
    // 페이지 언로드 시 최종 백업
    const handleBeforeUnload = () => {
      if (patients && patients.length > 0) {
        localStorage.setItem('hospitalPatients_backup', JSON.stringify(patients));
        console.log('📤 페이지 종료 시 환자 데이터 백업:', patients.length, '명');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [patients]);

  // 환자 정보 업데이트 함수들 (실시간 동기화)
  const updatePatientName = async (patientId, newName) => {
    try {
      console.log('🔥 환자 이름 업데이트 시작:', patientId, newName);
      
      // 즉시 로컬 상태 업데이트
    setPatients(prevPatients =>
      prevPatients.map(patient =>
          patient.id === patientId ? { ...patient, patient_name: newName } : patient
        )
      );
      
      // 서버에 실시간 업데이트 (관리자 액션으로 전송)
      const updateData = {
        type: 'update_patient_name',
        patientId,
        newName,
        timestamp: new Date()
      };
      
      console.log('🚀 서버로 전송할 데이터:', updateData);
      socketManager.emit('admin_action', updateData);
      
      // 추가: 직접 다른 클라이언트에게도 전송
      socketManager.emit('patient_name_updated', {
        patientId,
        newName
      });
      
    } catch (error) {
      console.error('환자 이름 업데이트 실패:', error);
    }
  };

    const updatePatientNumber = async (patientId, newNumber) => {
    try {
      console.log('환자 번호 업데이트:', patientId, newNumber);
      
      // 즉시 로컬 상태 업데이트
    setPatients(prevPatients =>
      prevPatients.map(patient =>
          patient.id === patientId ? { ...patient, patient_id: newNumber } : patient
        )
      );
      
      // 서버에 실시간 업데이트
      socketManager.emit('admin_action', {
        type: 'update_patient_number',
        patientId,
        newNumber,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('환자 번호 업데이트 실패:', error);
    }
  };

    const updatePatientProcedure = async (patientId, newProcedure) => {
    try {
      console.log('🏥 시술명 업데이트 시작:', patientId, newProcedure);
      
      // 즉시 로컬 상태 업데이트
      setPatients(prevPatients => {
        const updated = prevPatients.map(patient => {
          if (patient.id === patientId) {
            console.log(`📝 환자 ${patient.patient_name} 시술명 변경: ${patient.assigned_doctor} → ${newProcedure}`);
            return { ...patient, assigned_doctor: newProcedure, procedure: newProcedure };
          }
          return patient;
        });
        console.log('✅ 로컬 상태 시술명 업데이트 완료');
        return updated;
      });
      
      // 서버에 실시간 업데이트
      console.log('📤 서버로 시술명 업데이트 전송');
      await socketManager.updatePatientProcedure(patientId, newProcedure);
      console.log('🚀 시술명 업데이트 서버 전송 완료');
    } catch (error) {
      console.error('❌ 시술명 업데이트 실패:', error);
    }
  };

    const updatePatientDoctor = async (patientId, newDoctor) => {
    try {
      console.log('👨‍⚕️ 담당의사 업데이트 시작:', patientId, newDoctor);
      
      // 즉시 로컬 상태 업데이트
      setPatients(prevPatients => {
        const updated = prevPatients.map(patient => {
          if (patient.id === patientId) {
            console.log(`📝 환자 ${patient.patient_name} 담당의사 변경: ${patient.doctor} → ${newDoctor}`);
            return { ...patient, doctor: newDoctor };
          }
          return patient;
        });
        console.log('✅ 로컬 상태 담당의사 업데이트 완료');
        return updated;
      });
      
      // 서버에 실시간 업데이트
      console.log('📤 서버로 담당의사 업데이트 전송:', {
        type: 'update_patient_doctor',
        patientId,
        newDoctor,
        timestamp: new Date()
      });
      
      socketManager.emit('admin_action', {
        type: 'update_patient_doctor',
        patientId,
        newDoctor,
        timestamp: new Date()
      });
      
      console.log('🚀 담당의사 업데이트 서버 전송 완료');
    } catch (error) {
      console.error('❌ 담당의사 업데이트 실패:', error);
    }
  };

  const updatePatientNotes = async (patientId, newNotes) => {
    try {
      console.log('📝 비고 업데이트 시작:', patientId, newNotes);
      
      // 즉시 로컬 상태 업데이트
      setPatients(prevPatients => {
        const updated = prevPatients.map(patient => {
          if (patient.id === patientId) {
            console.log(`📝 환자 ${patient.patient_name} 비고 변경: "${patient.notes || ''}" → "${newNotes}"`);
            return { ...patient, notes: newNotes };
          }
          return patient;
        });
        console.log('✅ 로컬 상태 비고 업데이트 완료');
        return updated;
      });
      
      // 서버에 실시간 업데이트
      console.log('📤 서버로 비고 업데이트 전송');
      await socketManager.updatePatientNotes(patientId, newNotes);
      console.log('🚀 비고 업데이트 서버 전송 완료');
    } catch (error) {
      console.error('❌ 비고 업데이트 실패:', error);
    }
  };

  const updatePatientGenderAge = async (patientId, newGenderAge) => {
    try {
      console.log('👤 성별/나이 업데이트 시작:', patientId, newGenderAge);
      
      // 즉시 로컬 상태 업데이트
      setPatients(prevPatients => {
        const updated = prevPatients.map(patient => {
          if (patient.id === patientId) {
            console.log(`👤 환자 ${patient.patient_name} 성별/나이 변경: "${patient.gender_age || ''}" → "${newGenderAge}"`);
            return { ...patient, gender_age: newGenderAge };
          }
          return patient;
        });
        console.log('👤 성별/나이 로컬 상태 업데이트 완료');
        return updated;
      });
      
      console.log('📤 서버로 성별/나이 업데이트 전송');
      await socketManager.updatePatientGenderAge(patientId, newGenderAge);
      console.log('🚀 성별/나이 업데이트 서버 전송 완료');
    } catch (error) {
      console.error('❌ 성별/나이 업데이트 실패:', error);
    }
  };

  const updatePatientWard = async (patientId, newWard) => {
    try {
      console.log('🏥 병동 업데이트 시작:', patientId, newWard);
      
      // 즉시 로컬 상태 업데이트
      setPatients(prevPatients => {
        const updated = prevPatients.map(patient => {
          if (patient.id === patientId) {
            console.log(`🏥 환자 ${patient.patient_name} 병동 변경: "${patient.ward || ''}" → "${newWard}"`);
            return { ...patient, ward: newWard };
          }
          return patient;
        });
        console.log('🏥 병동 로컬 상태 업데이트 완료');
        return updated;
      });
      
      console.log('📤 서버로 병동 업데이트 전송');
      await socketManager.updatePatientWard(patientId, newWard);
      console.log('🚀 병동 업데이트 서버 전송 완료');
    } catch (error) {
      console.error('❌ 병동 업데이트 실패:', error);
    }
  };

  // 환자 날짜 업데이트 함수 추가
  const updatePatientDate = async (patientId, newDate) => {
    try {
      console.log('📅 환자 날짜 업데이트 시작:', patientId, newDate);
      
      // 현재 화면에서 해당 환자 찾기
      const targetPatient = patients.find(p => p.id === patientId);
      if (!targetPatient) {
        console.warn('❌ 환자를 찾을 수 없음:', patientId);
        return;
      }

      // 서버에 날짜 업데이트 전송
      console.log('📤 서버로 환자 날짜 업데이트 전송');
      await socketManager.updatePatientDate(patientId, newDate);
      console.log('🚀 환자 날짜 업데이트 서버 전송 완료');

      // 환자를 현재 화면에서 제거 (다른 날짜로 이동했으므로)
      if (newDate !== selectedDate) {
        setPatients(prevPatients => {
          const updated = prevPatients.filter(patient => patient.id !== patientId);
          console.log(`📅 환자 ${targetPatient.patient_name}을(를) 현재 화면에서 제거 (${targetPatient.patient_date} → ${newDate})`);
          return updated;
        });

        // 해당 날짜의 로컬 스토리지에 환자 추가
        const targetDateKey = `patients_${newDate}`;
        const existingData = localStorage.getItem(targetDateKey);
        const targetDatePatients = existingData ? JSON.parse(existingData) : [];
        
        // 업데이트된 환자 정보로 추가
        const updatedPatient = { ...targetPatient, patient_date: newDate };
        const existingIndex = targetDatePatients.findIndex(p => p.id === patientId);
        
        if (existingIndex >= 0) {
          targetDatePatients[existingIndex] = updatedPatient;
        } else {
          targetDatePatients.push(updatedPatient);
        }
        
        localStorage.setItem(targetDateKey, JSON.stringify(targetDatePatients));
        console.log(`💾 환자를 ${newDate} 로컬 스토리지에 저장 완료`);
      } else {
        // 같은 날짜로 업데이트하는 경우 (현재 화면에서 유지)
        setPatients(prevPatients => {
          const updated = prevPatients.map(patient => {
            if (patient.id === patientId) {
              console.log(`📅 환자 ${patient.patient_name} 날짜 업데이트: ${patient.patient_date} → ${newDate}`);
              return { ...patient, patient_date: newDate };
            }
            return patient;
          });
          return updated;
        });
      }

      // 현재 날짜의 로컬 스토리지 업데이트
      savePatientsForDate(patients, selectedDate);
      
    } catch (error) {
      console.error('❌ 환자 날짜 업데이트 실패:', error);
    }
  };

  const updatePatientStatus = async (patientId, newStatus, assignedDoctor = null) => {
    try {
      console.log('🔄 환자 상태 업데이트:', patientId, newStatus, assignedDoctor);
      
      // 즉시 로컬 상태 업데이트 (백엔드 서버가 없어도 작동)
      setPatients(prev => {
        const updated = prev.map(patient => {
          if (patient.id === patientId) {
            // 기존 시술명 보존 (assigned_doctor와 procedure 둘 다 확인)
            const currentProcedure = assignedDoctor || patient.assigned_doctor || patient.procedure || '';
            
            const updatedPatient = { 
              ...patient, 
              status: newStatus, 
              assigned_doctor: currentProcedure,
              procedure: currentProcedure // procedure 필드도 함께 업데이트
            };
            
            console.log(`📝 환자 ${patient.patient_name} 상태변경: ${patient.status} → ${newStatus}, 시술명="${currentProcedure}" 보존`);
            
            // 시술중으로 변경될 때 대기시간을 0분으로 즉시 설정
            if (newStatus === 'procedure') {
              console.log('🕐 시술중 상태로 변경 - 대기시간 0분으로 초기화');
              updatedPatient.wait_time = 0;
              updatedPatient.waitTime = 0; // 호환성을 위해 둘 다 설정
              updatedPatient.procedure_start_time = new Date().toISOString(); // 시작시간도 즉시 설정
              console.log('⏰ 시술 시작시간 설정:', updatedPatient.procedure_start_time);
            } else if (newStatus === 'waiting') {
              console.log('⏸️ 대기중 상태로 변경 - 대기시간 초기화');
              updatedPatient.wait_time = 0;
              updatedPatient.waitTime = 0;
              updatedPatient.procedure_start_time = null; // 시작시간도 초기화
              console.log('🔄 시술 시작시간 초기화');
            }
            
            return updatedPatient;
          }
          return patient;
        });
        
        // 백업은 useEffect에서 자동으로 처리됨
        
        return updated;
      });
      
      // 서버에 상태 업데이트 요청 (실시간 동기화)
      try {
        await socketManager.updatePatientStatus(patientId, newStatus, assignedDoctor);
        console.log('✅ 서버 업데이트 성공');
      } catch (serverError) {
        console.warn('⚠️ 서버 업데이트 실패 (로컬만 업데이트됨):', serverError);
      }
    } catch (error) {
      console.error('환자 상태 업데이트 실패:', error);
    }
  };

  // 환자 추가 (로컬 즉시 추가 + 서버 동기화)
  const addPatient = async (patientData) => {
    try {
      console.log('🆕 환자 추가 시작:', patientData);
      console.log('📋 받은 환자 데이터 필드들:', {
        name: patientData.name,
        number: patientData.number,
        procedure: patientData.procedure,
        doctor: patientData.doctor,
        notes: patientData.notes,
        genderAge: patientData.genderAge,
        ward: patientData.ward
      });
      
      const newPatientData = {
        patient_name: patientData.name,
        patient_id: patientData.number,
        department: patientData.room,
        assigned_doctor: patientData.procedure, // 시술명을 assigned_doctor로 저장
        doctor: patientData.doctor, // 담당의사
        notes: patientData.notes || '', // 비고
        gender_age: patientData.genderAge || '', // 성별/나이
        ward: patientData.ward || '', // 병동
        priority: patientData.priority || 1,
        patient_date: selectedDate // 선택된 날짜 추가
      };
      
      // 임시 ID로 즉시 로컬에 추가 (백엔드 서버가 없어도 작동)
      const tempPatient = {
        id: Date.now(), // 임시 ID
        patient_name: patientData.name,
        patient_id: patientData.number,
        department: patientData.room,
        assigned_doctor: patientData.procedure, // 시술명 저장
        doctor: patientData.doctor, // 담당의사 저장
        notes: patientData.notes || '', // 비고 저장
        gender_age: patientData.genderAge || '', // 성별/나이 저장
        ward: patientData.ward || '', // 병동 저장
        priority: patientData.priority || 1,
        status: 'waiting',
        wait_time: 0,
        patient_date: selectedDate, // 선택된 날짜 추가
        addedAt: Date.now(), // 새로 추가된 시간
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log(`🆕 새 환자 생성: ${tempPatient.patient_name}, 시술명=${tempPatient.assigned_doctor}, 담당의사=${tempPatient.doctor}, 병동=${tempPatient.ward}, 비고=${tempPatient.notes}, 날짜=${tempPatient.patient_date}`);
      console.log('🔍 환자 추가 시 날짜 정보:', {
        'selectedDate': selectedDate,
        'tempPatient.patient_date': tempPatient.patient_date,
        'getTodayDate()': getTodayDate(),
        '날짜 일치': tempPatient.patient_date === selectedDate
      });
      
      // 현재 선택된 날짜와 환자의 날짜가 일치하는지 확인
      if (tempPatient.patient_date === selectedDate) {
        // 선택된 날짜와 일치하면 현재 화면에 추가 (즉시 동기적 업데이트)
        flushSync(() => {
          setPatients(prev => {
            const updated = [...prev, tempPatient];
            console.log('✅ 현재 날짜에 환자 추가 (동기적 업데이트):', tempPatient);
            console.log('📋 추가된 환자의 병동:', tempPatient.ward, '비고:', tempPatient.notes);
            return updated;
          });
        });
      } else {
        console.log('📅 다른 날짜 환자 추가 - 현재 화면에는 표시하지 않음:', tempPatient.patient_date);
      }
      
      // 해당 날짜의 로컬 스토리지에도 저장
      const targetDateKey = `patients_${tempPatient.patient_date}`;
      const existingData = localStorage.getItem(targetDateKey);
      const targetDatePatients = existingData ? JSON.parse(existingData) : [];
      targetDatePatients.push(tempPatient);
      localStorage.setItem(targetDateKey, JSON.stringify(targetDatePatients));
      console.log('💾 해당 날짜 로컬 스토리지에 환자 저장:', tempPatient.patient_date);
      
      console.log('📤 서버로 전송할 환자 데이터:', newPatientData);
      
      // 서버에 새 환자 추가 요청
      try {
        await socketManager.addPatient(newPatientData);
        console.log('✅ 서버 추가 성공');
      } catch (serverError) {
        console.error('⚠️ 서버 추가 실패:', serverError);
        
        // 🔥 중복 오류인 경우 사용자에게 알림
        if (serverError.message && serverError.message.includes('중복')) {
          alert(`❌ 환자 추가 실패\n\n${serverError.message}\n\n같은 등록번호의 환자가 해당 날짜에 이미 존재합니다.`);
          
          // 로컬에 추가된 임시 환자 제거
          if (tempPatient.patient_date === selectedDate) {
            setPatients(prev => prev.filter(p => p.id !== tempPatient.id));
          }
          
          // 로컬 스토리지에서도 제거
          const targetDateKey = `patients_${tempPatient.patient_date}`;
          const existingData = localStorage.getItem(targetDateKey);
          if (existingData) {
            const targetDatePatients = JSON.parse(existingData);
            const filteredPatients = targetDatePatients.filter(p => p.id !== tempPatient.id);
            localStorage.setItem(targetDateKey, JSON.stringify(filteredPatients));
          }
          
          return; // 함수 종료
        } else {
          console.warn('⚠️ 서버 추가 실패하지만 로컬에는 추가됨:', serverError.message);
        }
      }
    } catch (error) {
      console.error('환자 추가 실패:', error);
    }
  };

  // 외래 진료 스케줄 업데이트
  const updateSchedule = async (newSchedule) => {
    try {
      console.log('🔥 HospitalBoard - 스케줄 업데이트 시작:', newSchedule);
      
      // 즉시 로컬 상태 업데이트
      setSchedule(newSchedule);
      console.log('✅ HospitalBoard - 로컬 스케줄 업데이트 완료');
      
      // 서버에 스케줄 업데이트 전송
      console.log('🌐 HospitalBoard - 서버 API 호출 시작');
      const result = await socketManager.updateSchedule(newSchedule);
      console.log('🚀 HospitalBoard - 스케줄 서버 업데이트 완료:', result);
      
      // 추가: 직접 Socket.IO로 다른 클라이언트에게 전송
      socketManager.emit('schedule_broadcast', {
        type: 'schedule_update',
        schedule: newSchedule,
        timestamp: new Date()
      });
      console.log('📡 HospitalBoard - Socket.IO 브로드캐스트 전송 완료');
      
    } catch (error) {
      console.error('❌ HospitalBoard - 스케줄 업데이트 실패:', error);
    }
  };



  // 환자 방 이동 (드래그 앤 드롭)
  const movePatientToRoom = async (patientId, newRoom) => {
    try {
      console.log('🏠 환자 방 이동:', patientId, '→', newRoom);
      
      // 즉시 로컬 상태 업데이트
      setPatients(prevPatients => {
        const updated = prevPatients.map(patient => {
          if (patient.id === patientId) {
            console.log(`🔄 환자 ${patient.patient_name} 방 이동: ${patient.department} → ${newRoom}`);
            // 완료된 환자를 이동시킬 때는 상태를 'waiting'으로 변경
            const newStatus = patient.status === 'completed' ? 'waiting' : patient.status;
            if (patient.status === 'completed') {
              console.log(`✨ 완료된 환자를 ${newRoom}으로 복귀: 상태를 'waiting'으로 변경`);
            }
            return { 
              ...patient, 
              department: newRoom, 
              room: newRoom,
              status: newStatus,
              wait_time: newStatus === 'waiting' ? 0 : patient.wait_time // 대기 상태로 변경 시 대기시간 초기화
            };
          }
          return patient;
        });
        console.log('✅ 로컬 상태 방 이동 완료');
        return updated;
      });
      
      // 서버에 방 이동 업데이트 전송
      console.log('📤 서버로 방 이동 업데이트 전송:', {
        type: 'move_patient_room',
        patientId,
        newRoom,
        timestamp: new Date()
      });
      
      socketManager.emit('admin_action', {
        type: 'move_patient_room',
        patientId,
        newRoom,
        timestamp: new Date()
      });
      
      console.log('🚀 방 이동 서버 전송 완료');
    } catch (error) {
      console.error('❌ 환자 방 이동 실패:', error);
    }
  };

  // 환자 순서 변경
  const reorderPatients = async (patientOrders) => {
    try {
      console.log('🔄 환자 순서 변경 시작:', patientOrders);
      
      // 서버에 순서 변경 요청
      await socketManager.reorderPatients(patientOrders);
      console.log('🚀 환자 순서 변경 서버 전송 완료');
    } catch (error) {
      console.error('❌ 환자 순서 변경 실패:', error);
    }
  };

  // 환자 삭제 (로컬 즉시 삭제 + 서버 동기화 + 백업 업데이트)
  const deletePatient = async (patientId) => {
    try {
      console.log('🗑️ 환자 삭제 시작:', patientId);
      
      // 즉시 로컬 상태에서 삭제 (백엔드 서버가 없어도 작동)
      setPatients(prev => {
        const filtered = prev.filter(patient => patient.id !== patientId);
        console.log('✅ 로컬에서 환자 삭제 완료:', patientId);
        
        // 백업은 useEffect에서 자동으로 처리됨 (삭제된 상태도 유지)
        
        return filtered;
      });
      
      // 서버에 삭제 요청 (실시간 동기화)
      try {
        await socketManager.deletePatient(patientId);
        console.log('✅ 서버 삭제 성공');
      } catch (serverError) {
        console.warn('⚠️ 서버 삭제 실패 (로컬 백업으로 유지):', serverError);
      }
    } catch (error) {
      console.error('환자 삭제 실패:', error);
    }
  };

  // xlsx 파일 업로드 처리
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('📁 파일 업로드 시작:', file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log('📊 엑셀 데이터 파싱 완료:', jsonData);

        // 첫 번째 행은 헤더이므로 2번째 행부터 처리
        const dataRows = jsonData.slice(1);
        let successCount = 0;
        let failCount = 0;

        dataRows.forEach((row, index) => {
          // 빈 행 스킵
          if (!row || row.length === 0 || !row[1]) {
            return;
          }

          // 데이터 매핑
          // A=0, B=1(구분), C=2, D=3, E=4, F=5(집도의), G=6(수술명), H=7, I=8(등록번호), J=9(성명), K=10(S/A), L=11, M=12, N=13(비고)
          const registrationNumber = row[8] || ''; // I컬럼 - 등록번호
          const patientName = row[9] || ''; // J컬럼 - 성명
          const procedureName = row[6] || ''; // G컬럼 - 수술명
          const doctorName = row[5] || ''; // F컬럼 - 집도의
          const genderAge = row[10] || ''; // K컬럼 - S/A
          const ward = 'GW'; // B컬럼 - 구분 (default로 GW)
          const notes = row[13] || ''; // N컬럼 - 비고

          // 필수 필드 확인 (등록번호와 성명이 있어야 함)
          if (!registrationNumber || !patientName) {
            console.log(`⚠️ 행 ${index + 2}: 필수 필드 누락 (등록번호: ${registrationNumber}, 성명: ${patientName})`);
            failCount++;
            return;
          }

          // 환자 추가
          const patientData = {
            name: patientName,
            number: String(registrationNumber),
            room: 'Angio 1R', // 기본 방
            procedure: procedureName,
            doctor: doctorName,
            genderAge: genderAge,
            ward: ward,
            notes: notes,
            priority: 1
          };

          console.log(`✅ 행 ${index + 2} 처리:`, patientData);
          addPatient(patientData);
          successCount++;
        });

        alert(`✅ 파일 업로드 완료!\n\n성공: ${successCount}명\n실패: ${failCount}명`);
        
        // 파일 입력 초기화
        e.target.value = '';
      } catch (error) {
        console.error('❌ 엑셀 파일 처리 실패:', error);
        alert('엑셀 파일 처리 중 오류가 발생했습니다.\n' + error.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // 의사 상태 업데이트 (실시간 동기화)
  const updateDoctorStatus = async (doctorId, status, currentPatient = null) => {
    try {
      console.log('의사 상태 업데이트:', doctorId, status, currentPatient);
      
      // 즉시 로컬 상태 업데이트
      setDoctors(prevDoctors =>
        prevDoctors.map(doctor =>
          doctor.id === doctorId ? { ...doctor, status, current_patient: currentPatient } : doctor
        )
      );
      
      // 서버에 실시간 업데이트
      await socketManager.updateDoctorStatus(doctorId, status, currentPatient);
    } catch (error) {
      console.error('의사 상태 업데이트 실패:', error);
    }
  };


  // 에러 발생 시 에러 화면 표시
  if (error) {
    return (
      <div className="min-h-screen p-3 md:p-6 flex items-center justify-center">
        <div className="bg-red-900/30 border border-red-500/50 text-red-300 p-8 rounded-xl max-w-md">
          <h2 className="text-2xl font-bold mb-4">❌ 연결 오류</h2>
          <p className="mb-4">백엔드 서버 연결에 실패했습니다:</p>
          <p className="text-sm bg-red-800/50 p-3 rounded">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  
  // 데이터 상태 체크
  if (!patients || !doctors) {
    // 로그 제거됨
  }

  return (
    <div className={`min-h-screen p-3 md:p-6 transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-black' 
        : 'bg-white'
    }`}>
      <div className="max-w-full mx-auto px-4">
        {/* 사용자 정보 확인 */}
        {!user && (
          <div className={`text-center mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            <p>사용자 정보를 불러오는 중...</p>
          </div>
        )}
        {/* 헤더 */}
        <div className="text-center mb-8 relative">
          {/* 선택된 날짜 표시 (왼쪽 위) */}
          <div className={`absolute top-0 left-0 text-lg font-medium transition-colors duration-300 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {new Date(selectedDate).toLocaleDateString('ko-KR', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              weekday: 'long'
            })} 환자 현황
          </div>

          {/* 버튼들 (우측) */}
          <div className="absolute top-0 right-0 flex gap-2">
            {/* 달력 버튼 */}
            <div className="relative date-picker-container">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`
                  p-3 rounded-xl transition-all duration-300
                  ${isDarkMode 
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/30' 
                    : 'bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/30'
                  }
                  border-2 backdrop-blur-md
                `}
                title="날짜 선택"
              >
                <Calendar className="w-6 h-6" />
              </button>
              
              {/* 날짜 선택 드롭다운 */}
              {showDatePicker && (
                <div 
                  className={`
                    absolute top-full right-0 mt-2 p-4 rounded-xl border-2 backdrop-blur-md shadow-lg min-w-[200px]
                    ${isDarkMode 
                      ? 'bg-black/90 border-purple-500 text-white' 
                      : 'bg-white/95 border-purple-500 text-black'
                    }
                  `}
                  style={{ zIndex: 9999 }}
                >
                  {/* 빠른 날짜 이동 버튼들 */}
                  <div className="flex gap-1 mb-3">
                    <button
                      onClick={() => {
                        const today = new Date()
                        today.setDate(today.getDate() - 1)
                        const year = today.getFullYear()
                        const month = String(today.getMonth() + 1).padStart(2, '0')
                        const day = String(today.getDate()).padStart(2, '0')
                        const yesterday = `${year}-${month}-${day}`
                        console.log('📅 어제 버튼 클릭 - 설정할 날짜:', yesterday)
                        console.log('🔄 selectedDate 변경: 어제 버튼 →', yesterday)
                        setSelectedDate(yesterday)
                        setShowDatePicker(false)
                      }}
                      className={`
                        flex-1 px-2 py-2 rounded text-sm font-medium transition-colors duration-200
                        ${isDarkMode 
                          ? 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-600/30' 
                          : 'bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300'
                        }
                      `}
                    >
                      어제
                    </button>
                    <button
                      onClick={() => {
                        const today = getTodayDate()
                        console.log('📅 오늘 버튼 클릭 - 설정할 날짜:', today)
                        console.log('🔄 selectedDate 변경: 오늘 버튼 →', today)
                        setSelectedDate(today)
                        setShowDatePicker(false)
                      }}
                      className={`
                        flex-1 px-2 py-2 rounded text-sm font-medium transition-colors duration-200
                        ${isDarkMode 
                          ? 'bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-600/30' 
                          : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                        }
                      `}
                    >
                      오늘
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date()
                        today.setDate(today.getDate() + 1)
                        const year = today.getFullYear()
                        const month = String(today.getMonth() + 1).padStart(2, '0')
                        const day = String(today.getDate()).padStart(2, '0')
                        const tomorrow = `${year}-${month}-${day}`
                        console.log('📅 내일 버튼 클릭 - 설정할 날짜:', tomorrow)
                        console.log('🔄 selectedDate 변경: 내일 버튼 →', tomorrow)
                        setSelectedDate(tomorrow)
                        setShowDatePicker(false)
                      }}
                      className={`
                        flex-1 px-2 py-2 rounded text-sm font-medium transition-colors duration-200
                        ${isDarkMode 
                          ? 'bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-600/30' 
                          : 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300'
                        }
                      `}
                    >
                      내일
                    </button>
                  </div>
                  
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      console.log('🔄 selectedDate 변경: 날짜 입력 →', e.target.value)
                      setSelectedDate(e.target.value)
                      setShowDatePicker(false)
                    }}
                    className={`
                      w-full px-3 py-2 rounded-lg border text-sm
                      ${isDarkMode 
                        ? 'bg-gray-800 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-black'
                      }
                    `}
                  />
                </div>
              )}
            </div>

            {/* 테마 토글 버튼 */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`
                p-3 rounded-xl transition-all duration-300
                ${isDarkMode 
                  ? 'bg-yellow-600/20 border-yellow-500 text-yellow-300 hover:bg-yellow-600/30' 
                  : 'bg-gray-600/20 border-gray-500 text-gray-300 hover:bg-gray-600/30'
                }
                border-2 backdrop-blur-md
              `}
              title={isDarkMode ? "라이트 모드" : "다크 모드"}
            >
              {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </button>

            {/* 개인정보 보호 토글 버튼 */}
            <button
              onClick={() => setIsPrivacyMode(!isPrivacyMode)}
              className={`
                p-3 rounded-xl transition-all duration-300
                ${isPrivacyMode 
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300 hover:bg-blue-600/30' 
                  : 'bg-orange-600/20 border-orange-500 text-orange-300 hover:bg-orange-600/30'
                }
                border-2 backdrop-blur-md
              `}
              title={isPrivacyMode ? "개인정보 표시" : "개인정보 숨김"}
            >
              {isPrivacyMode ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
            </button>
            
            {/* 관리자 모드 토글 버튼 */}
            <button
              onClick={() => setIsAdminMode(!isAdminMode)}
              className={`
                p-3 rounded-xl transition-all duration-300
                ${isAdminMode 
                  ? 'bg-red-600/20 border-red-500 text-red-300 hover:bg-red-600/30' 
                  : 'bg-gray-600/20 border-gray-500 text-gray-300 hover:bg-gray-600/30'
                }
                border-2 backdrop-blur-md
              `}
              title={isAdminMode ? "관리자 모드 종료" : "관리자 모드 시작"}
            >
              {isAdminMode ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </button>

            {/* 로그아웃 버튼 */}
            <button
              onClick={onLogout}
              className="p-3 rounded-xl transition-all duration-300 bg-red-600/20 border-2 border-red-500 text-red-300 hover:bg-red-600/30 backdrop-blur-md"
              title="로그아웃"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 mb-4">
            <h1 className={`text-4xl md:text-6xl font-bold transition-colors duration-300 ${
              isDarkMode ? 'text-white' : 'text-black'
            }`}>
              심장뇌혈관 시술센터 현황판
            </h1>
          </div>

          <CurrentTime isDarkMode={isDarkMode} />
        </div>

        {/* 메인 콘텐츠 */}
        <div className="grid grid-cols-1 xl:grid-cols-10 gap-8">
          {/* 메인 영역 - Angio방들 */}
          <div className="xl:col-span-8 space-y-6">
            {/* Angio방들 3열 배치 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Angio 1R */}
              <div>
                <PatientQueue 
                  patients={patients.filter(p => {
                    const isCorrectRoom = (p.department === 'Angio 1R' || p.room === 'Angio 1R');
                    const isNotCompleted = p.status !== 'completed';
                    const isCorrectDate = p.patient_date === selectedDate;
                    
                    if (isCorrectRoom && isNotCompleted && !isCorrectDate) {
                      console.log('🔍 Angio 1R 날짜 불일치:', p.patient_name, 'patient_date:', p.patient_date, 'selectedDate:', selectedDate);
                    }
                    
                    return isCorrectRoom && isNotCompleted && isCorrectDate;
                  })} 
                  roomTitle="Angio 1R"
                  selectedDate={selectedDate}
                  isAdminMode={isAdminMode}
                  isPrivacyMode={isPrivacyMode}
                  isDarkMode={isDarkMode}
                  onUpdatePatientName={updatePatientName}
                  onUpdatePatientNumber={updatePatientNumber}
                  onUpdatePatientStatus={updatePatientStatus}
                  onUpdatePatientProcedure={updatePatientProcedure}
                  onUpdatePatientDoctor={updatePatientDoctor}
                  onUpdatePatientNotes={updatePatientNotes}
                  onUpdatePatientGenderAge={updatePatientGenderAge}
                  onUpdatePatientWard={updatePatientWard}
                  onUpdatePatientDate={updatePatientDate}
                  onAddPatient={addPatient}
                  onDeletePatient={deletePatient}
                  onMovePatientToRoom={movePatientToRoom}
                  onReorderPatients={reorderPatients}
                  onEditingPatientChange={setEditingPatientId}
                />
              </div>

              {/* Angio 2R */}
              <div>
                <PatientQueue 
                  patients={patients.filter(p => (p.department === 'Angio 2R' || p.room === 'Angio 2R') && p.status !== 'completed' && p.patient_date === selectedDate)} 
                  roomTitle="Angio 2R"
                  selectedDate={selectedDate}
                  isAdminMode={isAdminMode}
                  isPrivacyMode={isPrivacyMode}
                  isDarkMode={isDarkMode}
                  onUpdatePatientName={updatePatientName}
                  onUpdatePatientNumber={updatePatientNumber}
                  onUpdatePatientStatus={updatePatientStatus}
                  onUpdatePatientProcedure={updatePatientProcedure}
                  onUpdatePatientDoctor={updatePatientDoctor}
                  onUpdatePatientNotes={updatePatientNotes}
                  onUpdatePatientGenderAge={updatePatientGenderAge}
                  onUpdatePatientWard={updatePatientWard}
                  onUpdatePatientDate={updatePatientDate}
                  onAddPatient={addPatient}
                  onDeletePatient={deletePatient}
                  onMovePatientToRoom={movePatientToRoom}
                  onReorderPatients={reorderPatients}
                  onEditingPatientChange={setEditingPatientId}
                />
              </div>

              {/* Hybrid room */}
              <div>
                <PatientQueue 
                  patients={patients.filter(p => (p.department === 'Hybrid Room' || p.room === 'Hybrid Room') && p.status !== 'completed' && p.patient_date === selectedDate)} 
                  roomTitle="Hybrid Room"
                  selectedDate={selectedDate}
                  isAdminMode={isAdminMode}
                  isPrivacyMode={isPrivacyMode}
                  isDarkMode={isDarkMode}
                  onUpdatePatientName={updatePatientName}
                  onUpdatePatientNumber={updatePatientNumber}
                  onUpdatePatientStatus={updatePatientStatus}
                  onUpdatePatientProcedure={updatePatientProcedure}
                  onUpdatePatientDoctor={updatePatientDoctor}
                  onUpdatePatientNotes={updatePatientNotes}
                  onUpdatePatientGenderAge={updatePatientGenderAge}
                  onUpdatePatientWard={updatePatientWard}
                  onUpdatePatientDate={updatePatientDate}
                  onAddPatient={addPatient}
                  onDeletePatient={deletePatient}
                  onMovePatientToRoom={movePatientToRoom}
                  onReorderPatients={reorderPatients}
                  onEditingPatientChange={setEditingPatientId}
                />
              </div>
            </div>

            {/* 외래 진료일정 */}
            <div>
              <DoctorSchedule 
                isAdminMode={isAdminMode} 
                doctors={doctors}
                schedule={schedule}
                onUpdateDoctorStatus={updateDoctorStatus}
                onUpdateSchedule={updateSchedule}
                isDarkMode={isDarkMode}
              />
            </div>
          </div>

          {/* 사이드바 - 환자 요약 */}
          <div className="xl:col-span-2 space-y-4">
            <PatientSummary 
              patients={patients.filter(p => p.patient_date === selectedDate)} 
              selectedDate={selectedDate}
              isPrivacyMode={isPrivacyMode} 
              isAdminMode={isAdminMode} 
              isDarkMode={isDarkMode} 
              onMovePatientToRoom={movePatientToRoom} 
            />
            
            {/* 전체통계 버튼과 첨부 버튼 */}
            <div className={`
              rounded-2xl backdrop-blur-md border-2 p-4 space-y-3
              ${isDarkMode 
                ? 'bg-black/40 border-purple-500/50' 
                : 'bg-white/80 border-purple-300/50'
              }
            `}>
              {/* 전체통계 버튼 */}
              <button
                onClick={() => setShowStatistics(true)}
                className={`
                  w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl
                  font-semibold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95
                  ${isDarkMode 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/25' 
                    : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg shadow-purple-500/25'
                  }
                `}
              >
                <BarChart3 className="w-6 h-6" />
                전체 통계
              </button>

              {/* 첨부 버튼 */}
              <label
                htmlFor="excel-upload"
                className={`
                  w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl
                  font-semibold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer
                  ${isDarkMode 
                    ? 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white shadow-lg shadow-green-500/25' 
                    : 'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-lg shadow-green-500/25'
                  }
                `}
              >
                <Upload className="w-6 h-6" />
                첨부
              </label>
              <input
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 전체통계 모달 */}
      <StatisticsModal 
        isOpen={showStatistics}
        onClose={() => setShowStatistics(false)}
        isDarkMode={isDarkMode}
      />
    </div>
  )
}

export default HospitalBoard
