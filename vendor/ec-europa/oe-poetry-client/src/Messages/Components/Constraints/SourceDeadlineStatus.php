<?php

namespace EC\Poetry\Messages\Components\Constraints;

use Symfony\Component\Validator\Constraints\Choice;
use Symfony\Component\Validator\Constraints\ChoiceValidator;

/**
 * @Annotation
 * @Target({"PROPERTY", "METHOD", "ANNOTATION"})
 *
 * @package EC\Poetry\Messages\Components\Constraints
 */
class SourceDeadlineStatus extends Choice
{
    /**
     * {@inheritdoc}
     */
    public function __construct()
    {
        parent::__construct([
            'PUBLIC',
            'DELETED',
        ]);
    }

    /**
     * {@inheritdoc}
     */
    public function validatedBy()
    {
        return ChoiceValidator::class;
    }
}
