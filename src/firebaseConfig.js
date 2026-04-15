/**
 * Firebase 配置
 * 用于存储用户问卷统计数据（仅管理员可查看）
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDx4dxlZn7KAMEAYRWUZjoHgp9LrA6nufA",
  authDomain: "fbti-10136.firebaseapp.com",
  projectId: "fbti-10136",
  storageBucket: "fbti-10136.firebasestorage.app",
  messagingSenderId: "118920787161",
  appId: "1:118920787161:web:0b0f0ee412eca7d6577ac8",
  measurementId: "G-BDC2KFF4GM"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * 获取用户 IP 地址
 * @returns {Promise<string>}
 */
async function getUserIP() {
  try {
    const response = await fetch('https://ipinfo.io/json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error) {
    console.warn("获取 IP 失败:", error);
    return 'unknown';
  }
}

/**
 * 上传问卷结果到 Firebase
 * @param {Object} data - 完整的问卷数据
 * @param {Object} data.firstQuestion - 第一个题目数据
 * @param {Object} data.allAnswers - 所有题目作答数据
 * @param {Object} data.result - 最终结果
 * @param {Object} data.meta - 元数据
 */
export async function uploadResult(data) {
  try {
    // 获取用户 IP
    const ip = await getUserIP();

    const docRef = await addDoc(collection(db, "results"), {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      ip: ip,
      ...data,
    });
    console.log("结果已上传，ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("上传失败:", error);
    return null;
  }
}

/**
 * 获取总计数
 * @returns {Promise<number>}
 */
export async function getTotalCount() {
  try {
    const snapshot = await getDocs(collection(db, "results"));
    return snapshot.size;
  } catch (error) {
    console.error("获取计数失败:", error);
    return 0;
  }
}

/**
 * 获取最近的结果列表
 * @param {number} limitCount - 限制数量
 * @returns {Promise<Array>}
 */
export async function getRecentResults(limitCount = 10) {
  try {
    const q = query(
      collection(db, "results"),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("获取结果列表失败:", error);
    return [];
  }
}

export { db };
