import {test} from 'node:test'
import assert from 'node:assert/strict'
import {TrackingBudget} from '../src/papa-tracking.ts'
test('Tracking workload adapts with bounds while retaining the render loop',()=>{
  const budget=new TrackingBudget()
  for(let i=0;i<30;i++)budget.sample(100)
  assert.equal(budget.interval,160)
  for(let i=0;i<60;i++)budget.sample(4)
  assert.equal(budget.interval,45)
  const before=budget.interval;budget.sample(NaN);budget.sample(-5);assert.equal(budget.interval,before)
})
