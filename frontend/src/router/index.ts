import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          redirect: '/drives',
        },
        {
          path: 'drives',
          name: 'drives',
          component: () => import('../views/DrivesView.vue'),
        },
        {
          path: 'files/:driveId',
          name: 'files',
          component: () => import('../views/FilesView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    return { name: 'login' }
  }
  if (to.name === 'login' && token) {
    return { name: 'home' }
  }
})

export default router
