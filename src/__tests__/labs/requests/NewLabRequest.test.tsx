import { Button, Typeahead, Label, Alert } from '@hospitalrun/components'
import { mount, ReactWrapper } from 'enzyme'
import { createMemoryHistory } from 'history'
import React from 'react'
import { act } from 'react-dom/test-utils'
import { Provider } from 'react-redux'
import { Router } from 'react-router-dom'
import createMockStore from 'redux-mock-store'
import thunk from 'redux-thunk'

import NewLabRequest from '../../../labs/requests/NewLabRequest'
import * as validationUtil from '../../../labs/utils/validate-lab'
import { LabError } from '../../../labs/utils/validate-lab'
import * as titleUtil from '../../../page-header/title/TitleContext'
import TextFieldWithLabelFormGroup from '../../../shared/components/input/TextFieldWithLabelFormGroup'
import TextInputWithLabelFormGroup from '../../../shared/components/input/TextInputWithLabelFormGroup'
import LabRepository from '../../../shared/db/LabRepository'
import PatientRepository from '../../../shared/db/PatientRepository'
import Lab from '../../../shared/model/Lab'
import Patient from '../../../shared/model/Patient'
import { RootState } from '../../../shared/store'

const mockStore = createMockStore<RootState, any>([thunk])
describe('New Lab Request', () => {
  let history: any
  const setup = async (
    store = mockStore({ title: '', user: { user: { id: 'userId' } } } as any),
  ) => {
    history = createMemoryHistory()
    history.push(`/labs/new`)
    jest.spyOn(titleUtil, 'useUpdateTitle').mockImplementation(() => jest.fn())

    let wrapper: any
    await act(async () => {
      wrapper = await mount(
        <Provider store={store}>
          <Router history={history}>
            <titleUtil.TitleProvider>
              <NewLabRequest />
            </titleUtil.TitleProvider>
          </Router>
        </Provider>,
      )
    })

    wrapper.find(NewLabRequest).props().updateTitle = jest.fn()
    wrapper.update()
    return { wrapper: wrapper as ReactWrapper }
  }

  describe('form layout', () => {
    it('should have called the useUpdateTitle hook', async () => {
      await setup()
      expect(titleUtil.useUpdateTitle).toHaveBeenCalledTimes(1)
    })

    it('should render a patient typeahead', async () => {
      const { wrapper } = await setup()
      const typeaheadDiv = wrapper.find('.patient-typeahead')

      expect(typeaheadDiv).toBeDefined()

      const label = typeaheadDiv.find(Label)
      const typeahead = typeaheadDiv.find(Typeahead)

      expect(label).toBeDefined()
      expect(label.prop('text')).toEqual('labs.lab.patient')
      expect(typeahead).toBeDefined()
      expect(typeahead.prop('placeholder')).toEqual('labs.lab.patient')
      expect(typeahead.prop('searchAccessor')).toEqual('fullName')
    })

    it('should render a type input box', async () => {
      const { wrapper } = await setup()
      const typeInputBox = wrapper.find(TextInputWithLabelFormGroup)

      expect(typeInputBox).toBeDefined()
      expect(typeInputBox.prop('label')).toEqual('labs.lab.type')
      expect(typeInputBox.prop('isRequired')).toBeTruthy()
      expect(typeInputBox.prop('isEditable')).toBeTruthy()
    })

    it('should render a notes text field', async () => {
      const { wrapper } = await setup()
      const notesTextField = wrapper.find(TextFieldWithLabelFormGroup)

      expect(notesTextField).toBeDefined()
      expect(notesTextField.prop('label')).toEqual('labs.lab.notes')
      expect(notesTextField.prop('isRequired')).toBeFalsy()
      expect(notesTextField.prop('isEditable')).toBeTruthy()
    })

    it('should render a save button', async () => {
      const { wrapper } = await setup()
      const saveButton = wrapper.find(Button).at(0)
      expect(saveButton).toBeDefined()
      expect(saveButton.text().trim()).toEqual('labs.requests.save')
    })

    it('should render a cancel button', async () => {
      const { wrapper } = await setup()
      const cancelButton = wrapper.find(Button).at(1)
      expect(cancelButton).toBeDefined()
      expect(cancelButton.text().trim()).toEqual('actions.cancel')
    })
  })

  describe('errors', () => {
    const error = {
      message: 'some message',
      patient: 'some patient message',
      type: 'some type error',
    } as LabError

    jest.spyOn(validationUtil, 'validateLabRequest').mockReturnValue(error)

    it('should display errors', async () => {
      const { wrapper } = await setup()

      const saveButton = wrapper.find(Button).at(0)
      await act(async () => {
        const onClick = saveButton.prop('onClick') as any
        await onClick()
      })

      wrapper.update()

      const alert = wrapper.find(Alert)
      const typeInput = wrapper.find(TextInputWithLabelFormGroup)
      const patientTypeahead = wrapper.find(Typeahead)

      expect(alert.prop('message')).toEqual(error.message)
      expect(alert.prop('title')).toEqual('states.error')
      expect(alert.prop('color')).toEqual('danger')

      expect(patientTypeahead.prop('isInvalid')).toBeTruthy()

      expect(typeInput.prop('feedback')).toEqual(error.type)
      expect(typeInput.prop('isInvalid')).toBeTruthy()
    })
  })

  describe('on cancel', () => {
    it('should navigate back to /labs', async () => {
      const { wrapper } = await setup()
      const cancelButton = wrapper.find(Button).at(1)

      act(() => {
        const onClick = cancelButton.prop('onClick') as any
        onClick({} as React.MouseEvent<HTMLButtonElement>)
      })

      expect(history.location.pathname).toEqual('/labs')
    })
  })

  describe('on save', () => {
    let labRepositorySaveSpy: any
    const expectedDate = new Date()
    const expectedNotes = 'expected notes'
    const expectedLab = {
      patient: '12345',
      type: 'expected type',
      status: 'requested',
      notes: [expectedNotes],
      id: '1234',
      requestedOn: expectedDate.toISOString(),
    } as Lab
    const store = mockStore({
      lab: { status: 'loading', error: {} },
      user: { user: { id: 'fake id' } },
    } as any)

    beforeEach(() => {
      jest.resetAllMocks()
      Date.now = jest.fn(() => expectedDate.valueOf())
      labRepositorySaveSpy = jest.spyOn(LabRepository, 'save').mockResolvedValue(expectedLab as Lab)

      jest
        .spyOn(PatientRepository, 'search')
        .mockResolvedValue([{ id: expectedLab.patient, fullName: 'some full name' }] as Patient[])
    })

    it('should save the lab request and navigate to "/labs/:id"', async () => {
      const { wrapper } = await setup(store)

      const patientTypeahead = wrapper.find(Typeahead)
      await act(async () => {
        const onChange = patientTypeahead.prop('onChange')
        await onChange([{ id: expectedLab.patient }] as Patient[])
      })

      const typeInput = wrapper.find(TextInputWithLabelFormGroup)
      act(() => {
        const onChange = typeInput.prop('onChange') as any
        onChange({ currentTarget: { value: expectedLab.type } })
      })

      const notesTextField = wrapper.find(TextFieldWithLabelFormGroup)
      act(() => {
        const onChange = notesTextField.prop('onChange') as any
        onChange({ currentTarget: { value: expectedNotes } })
      })
      wrapper.update()

      const saveButton = wrapper.find(Button).at(0)
      await act(async () => {
        const onClick = saveButton.prop('onClick') as any
        await onClick()
      })

      expect(labRepositorySaveSpy).toHaveBeenCalledTimes(1)
      expect(labRepositorySaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          patient: expectedLab.patient,
          type: expectedLab.type,
          notes: expectedLab.notes,
          status: 'requested',
          requestedOn: expectedDate.toISOString(),
        }),
      )
      expect(history.location.pathname).toEqual(`/labs/${expectedLab.id}`)
    })
  })
})
